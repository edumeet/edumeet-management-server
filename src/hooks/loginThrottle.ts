import { createHash } from 'crypto';
import { isIP } from 'net';
import { TooManyRequests } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import { HookContext, NextFunction } from '../declarations';
import { logger } from '../logger';

const WINDOW_MS = 15 * 60 * 1000;
// Failed password logins one client address may make in the window. An IPv6 /64 is one address.
const MAX_FAILURES = 10;
// Failed password logins one account takes in the window, from all addresses together.
const MAX_ACCOUNT_FAILURES = 10;
const TIMING_PAD_MS = 400;
const CLEANUP_INTERVAL_MS = 60 * 1000;
// How long an address that signed in to an account stays exempt from that account's limit.
const KNOWN_ADDRESS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_KNOWN_ADDRESSES = 10000;
const MAX_EMAIL_KEY_LENGTH = 254;

// When TRUST_PROXY=true, the management server is behind a reverse proxy
// (nginx in the docker stack, or nginx-on-host) that appends the real client
// IP to X-Forwarded-For via `$proxy_add_x_forwarded_for`. The RIGHTMOST entry
// is what the proxy itself observed as the connection peer, and is the only
// entry not forgeable by the client. Leftmost entries are client-supplied
// and must never be trusted.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

// Failures are counted per key: a client address, an account, or an e-mail address no account
// has. An attempt takes a place in each of its buckets when it is admitted and gives it back
// when it has finished, so attempts that are still running count like failures. Otherwise a
// burst of any size passes while the first ten are still being checked.
interface Bucket {
	failures: number[];
	pending: number;
	blockedUntil: number;
}

const buckets = new Map<string, Bucket>();
// "<account key> <address key>" -> until when that address is known for that account.
const knownAddresses = new Map<string, number>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const ensureCleanup = () => {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();

		for (const [ key, bucket ] of buckets) {
			bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
			if (bucket.failures.length === 0 && bucket.pending === 0 && bucket.blockedUntil <= now) {
				buckets.delete(key);
			}
		}
		for (const [ key, until ] of knownAddresses) {
			if (until <= now) knownAddresses.delete(key);
		}
	}, CLEANUP_INTERVAL_MS);
	cleanupTimer.unref?.();
};

const groupsOf = (part: string | undefined): number[] => {
	if (!part) return [];

	const groups: number[] = [];

	for (const piece of part.split(':')) {
		if (piece.includes('.')) {
			const bytes = piece.split('.').map(Number);

			groups.push((bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3]);
		} else {
			groups.push(parseInt(piece, 16));
		}
	}

	return groups;
};

// The key failures of a client are counted under. An IPv6 customer has a /64 or more to send
// from, so the /64 is the client; counting each of its addresses alone limits nothing. An IPv4
// address written as IPv6 (::ffff:198.51.100.7) is that IPv4 address.
export const addressKey = (address: string): string => {
	const bare = address.trim().replace(/%.*$/, '');

	if (isIP(bare) !== 6) return bare.slice(0, 64);

	const [ head, tail ] = bare.split('::');
	const first = groupsOf(head);
	const last = groupsOf(tail);
	const groups = [ ...first, ...new Array(8 - first.length - last.length).fill(0), ...last ];

	if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
		return `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
	}

	return `${groups.slice(0, 4).map((g) => g.toString(16))
		.join(':')}::/64`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractIp = (params: any): string | undefined => {
	if (TRUST_PROXY) {
		const xff = params?.headers?.['x-forwarded-for'];

		if (typeof xff === 'string' && xff.length > 0) {
			const parts = xff
				.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean);

			if (parts.length > 0) return addressKey(parts[parts.length - 1]);
		}
	}
	const ip = params?.ip;

	if (ip) return addressKey(String(ip));

	// Never a shared fallback key: ten failures in it would block every password login.
	// app.ts puts the address into params for REST and socket.io, so this is only reached
	// by a transport that does not.
	return undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractEmail = (data: any): string => {
	if (typeof data?.email === 'string') return data.email;

	return '<no-email>';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractUa = (params: any): string =>
	String(params?.headers?.['user-agent'] || '<no-ua>');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isLocalLogin = (data: any): boolean => data?.strategy === 'local';

const padTiming = async (start: number) => {
	const elapsed = Date.now() - start;

	if (elapsed < TIMING_PAD_MS) {
		await new Promise((r) => setTimeout(r, TIMING_PAD_MS - elapsed));
	}
};

// Seconds until the bucket takes an attempt again; 0 when it takes one now, and 1 when it is
// full of attempts that have not finished yet.
const refusedFor = (key: string, max: number, now: number): number => {
	const bucket = buckets.get(key);

	if (!bucket) return 0;
	if (bucket.blockedUntil > now) return Math.ceil((bucket.blockedUntil - now) / 1000);

	bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);

	return bucket.failures.length + bucket.pending >= max ? 1 : 0;
};

// One key for the spellings a database may take for the same address: MySQL ignores case,
// accents and trailing spaces. It need not be exact, the count per account row does not rely
// on it.
const emailKey = (email: string): string => {
	const normalized = email.normalize('NFKD').replace(/\p{M}/gu, '')
		.trim()
		.toLowerCase();

	return normalized.length <= MAX_EMAIL_KEY_LENGTH
		? `email:${normalized}`
		: `email:sha256:${createHash('sha256').update(normalized)
			.digest('hex')}`;
};

const tooMany = () => new TooManyRequests('Too many login attempts');

export class LoginAttempt {
	readonly start = Date.now();
	#held: { key: string; max: number }[] = [];
	#signedIn: string | undefined;

	// eslint-disable-next-line no-unused-vars
	constructor(readonly address: string | undefined, readonly email: string, readonly ua: string) {}

	#hold(key: string, max: number) {
		let bucket = buckets.get(key);

		if (!bucket) {
			bucket = { failures: [], pending: 0, blockedUntil: 0 };
			buckets.set(key, bucket);
		}
		bucket.pending++;
		this.#held.push({ key, max });
	}

	#refuse(key: string, retryAfter: number): never {
		logger.warn(
			'login throttle: blocked key=%s ip=%s email=%s ua=%s retryAfter=%ss',
			key, this.address ?? '<no-ip>', this.email, this.ua, retryAfter
		);
		throw tooMany();
	}

	// Checking and taking the place happen in one synchronous step, so no other attempt gets in
	// between them.
	admitAddress() {
		if (!this.address) {
			logger.warn('login throttle: no client address, attempt limited per account only');

			return;
		}

		const key = `ip:${this.address}`;
		const retryAfter = refusedFor(key, MAX_FAILURES, Date.now());

		if (retryAfter) this.#refuse(key, retryAfter);
		this.#hold(key, MAX_FAILURES);
	}

	// Which of the accounts the submitted e-mail address found the password may be tried on.
	//
	// Failures are counted per account row, because the database decides which spellings find a
	// row and each spelling would otherwise have its own count. They are also counted per
	// submitted address, with or without an account, so that the answers do not tell which
	// addresses have one.
	//
	// Anyone can use up the limit of an account they know the address of, and its owner would
	// then be shut out too. An address that has signed in to an account before is therefore
	// not held to that account's limit, only to its own.
	admitAccounts(ids: Array<string | number>, email: string): Array<string | number> {
		const now = Date.now();
		const admitted = ids.filter((id) => this.#knows(id, now));
		const keys: string[] = [];
		let refused: { key: string; retryAfter: number } | undefined;

		const free = (key: string) => {
			const retryAfter = refusedFor(key, MAX_ACCOUNT_FAILURES, now);

			if (retryAfter) refused ??= { key, retryAfter };
			else keys.push(key);

			return !retryAfter;
		};

		if (admitted.length === 0 && !free(emailKey(email))) this.#refuse(refused!.key, refused!.retryAfter);

		for (const id of ids) {
			if (!admitted.includes(id) && free(`user:${id}`)) admitted.push(id);
		}

		if (ids.length > 0 && admitted.length === 0) this.#refuse(refused!.key, refused!.retryAfter);

		for (const key of keys) this.#hold(key, MAX_ACCOUNT_FAILURES);

		return admitted;
	}

	#knows(id: string | number, now: number): boolean {
		return Boolean(this.address) && (knownAddresses.get(`user:${id} ${this.address}`) ?? 0) > now;
	}

	// The account whose password matched.
	signedIn(id: string | number) {
		this.#signedIn = `user:${id}`;
	}

	// Gives the places back, and counts a failure in each bucket if the login failed.
	finish(outcome: 'success' | 'failure' | 'neither') {
		const now = Date.now();
		let failures = 0;

		for (const { key, max } of this.#held) {
			const bucket = buckets.get(key);

			if (!bucket) continue;
			bucket.pending = Math.max(0, bucket.pending - 1);
			if (outcome !== 'failure') continue;

			bucket.failures = bucket.failures.filter((t) => now - t < WINDOW_MS);
			bucket.failures.push(now);
			failures = Math.max(failures, bucket.failures.length);

			if (bucket.failures.length >= max) {
				bucket.blockedUntil = now + WINDOW_MS;
				logger.warn(
					'login throttle: tripped key=%s ip=%s email=%s ua=%s failures=%d windowMs=%d',
					key, this.address ?? '<no-ip>', this.email, this.ua, bucket.failures.length, WINDOW_MS
				);
			}
		}
		this.#held = [];

		if (outcome === 'failure') {
			logger.warn(
				'login failure ip=%s email=%s ua=%s failures=%d',
				this.address ?? '<no-ip>', this.email, this.ua, failures
			);
		}

		if (outcome === 'success' && this.#signedIn && this.address) {
			const known = `${this.#signedIn} ${this.address}`;

			// Deleted first, so the map stays ordered by last sign in and the oldest goes first.
			knownAddresses.delete(known);
			knownAddresses.set(known, now + KNOWN_ADDRESS_MS);
			if (knownAddresses.size > MAX_KNOWN_ADDRESSES) {
				knownAddresses.delete(knownAddresses.keys().next().value as string);
			}
		}
	}
}

const ATTEMPT = Symbol('loginAttempt');

// The attempt the throttle admitted, for the local strategy to check the accounts against.
// Feathers copies params on the way to the strategy; the copy keeps the symbol.
export const loginAttemptOf = (params: Params | undefined): LoginAttempt | undefined =>
	(params as Record<symbol, LoginAttempt | undefined> | undefined)?.[ATTEMPT];

// Brute-force limit and timing pad for password logins from outside. It wraps the whole
// login, so the places an attempt holds are given back however the attempt ends.
export const loginThrottle = async (context: HookContext, next: NextFunction) => {
	if (!context.params.provider || !isLocalLogin(context.data)) return next();

	ensureCleanup();

	const attempt = new LoginAttempt(
		extractIp(context.params),
		extractEmail(context.data),
		extractUa(context.params)
	);

	try {
		attempt.admitAddress();
		(context.params as Record<symbol, LoginAttempt>)[ATTEMPT] = attempt;
		await next();
		attempt.finish('success');
	} catch (error) {
		const code = (error as { code?: number } | undefined)?.code;

		// Only real credential failures count. A 5xx (database blip, internal error) is the
		// server's fault, and a 429 is the throttle's own refusal.
		attempt.finish(code === 401 ? 'failure' : 'neither');
		if (code === 401 || code === 429) await padTiming(attempt.start);

		throw error;
	}
};
