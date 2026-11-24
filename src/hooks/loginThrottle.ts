import { BlockList, isIP } from 'net';
import { TooManyRequests } from '@feathersjs/errors';
import { HookContext, NextFunction } from '../declarations';
import { logger } from '../logger';
import { hasSuperAdminRole } from '../auth/strategies/OAuthTenantStrategy';

const WINDOW_MS = 15 * 60 * 1000;
// Failed password logins one client address, or one super-admin or edumeet-server account, may
// have in the window. An IPv6 /64 is one address.
const MAX_FAILURES = 10;
const TIMING_PAD_MS = 400;
const CLEANUP_INTERVAL_MS = 60 * 1000;
// As in EdumeetLocalStrategy.
const MAX_ACCOUNTS_PER_EMAIL = 50;

// When TRUST_PROXY=true, the management server is behind a reverse proxy
// (nginx in the docker stack, or nginx-on-host) that appends the real client
// IP to X-Forwarded-For via `$proxy_add_x_forwarded_for`. The RIGHTMOST entry
// is what the proxy itself observed as the connection peer, and is the only
// entry not forgeable by the client. Leftmost entries are client-supplied
// and must never be trusted.
const trustProxy = () => process.env.TRUST_PROXY === 'true';

// An attempt takes a place when it is admitted and gives it back when it has finished, so
// attempts that are still running count like failures. Otherwise a burst of any size passes
// while the first ten are still being checked.
interface Bucket {
	failures: number[];
	pending: number;
	blockedUntil: number;
}

const ipState = new Map<string, Bucket>();
const accountState = new Map<string, Bucket>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const sweep = (state: Map<string, Bucket>, now: number) => {
	for (const [ key, entry ] of state) {
		entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);
		if (entry.failures.length === 0 && entry.pending === 0 && entry.blockedUntil <= now) {
			state.delete(key);
		}
	}
};

const ensureCleanup = () => {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();

		sweep(ipState, now);
		sweep(accountState, now);
	}, CLEANUP_INTERVAL_MS);
	cleanupTimer.unref?.();
};

const bucketOf = (state: Map<string, Bucket>, key: string, now: number): Bucket => {
	let entry = state.get(key);

	if (!entry) {
		entry = { failures: [], pending: 0, blockedUntil: 0 };
		state.set(key, entry);
	}
	entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);

	return entry;
};

const isFull = (entry: Bucket, now: number) =>
	entry.blockedUntil > now || entry.failures.length + entry.pending >= MAX_FAILURES;

const retryAfter = (entry: Bucket, now: number) => Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));

// True when this failure blocks the bucket.
const addFailure = (entry: Bucket, now: number): boolean => {
	entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);
	entry.failures.push(now);

	if (entry.failures.length < MAX_FAILURES) return false;

	entry.blockedUntil = now + WINDOW_MS;

	return true;
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

const bare = (address: string) => address.trim().replace(/%.*$/, '');

// The key failures of a client are counted under. An IPv6 customer has a /64 or more to send
// from, so the /64 is the client; counting each of its addresses alone limits nothing. An IPv4
// address written as IPv6 (::ffff:198.51.100.7) is that IPv4 address.
export const addressKey = (address: string): string => {
	const plain = bare(address);

	if (isIP(plain) !== 6) return plain.slice(0, 64);

	const [ head, tail ] = plain.split('::');
	const first = groupsOf(head);
	const last = groupsOf(tail);
	const groups = [ ...first, ...new Array(8 - first.length - last.length).fill(0), ...last ];

	if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
		return `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
	}

	return `${groups.slice(0, 4).map((g) => g.toString(16))
		.join(':')}::/64`;
};

// Failures on a super-admin or edumeet-server account are also counted per account, so many
// addresses together cannot guess its password. The room servers sign in with such an account, and
// attempts from their addresses are left out of that count, so nobody can shut them out: private
// addresses (a room server on the same machine or network, through Docker or a LAN) and
// ROOM_SERVER_ADDRESSES, IPs or CIDR ranges, comma separated, for room servers elsewhere.
const PRIVATE_RANGES: [ string, number, 'ipv4' | 'ipv6' ][] = [
	[ '10.0.0.0', 8, 'ipv4' ],
	[ '172.16.0.0', 12, 'ipv4' ],
	[ '192.168.0.0', 16, 'ipv4' ],
	[ '127.0.0.0', 8, 'ipv4' ],
	[ '::1', 128, 'ipv6' ],
	[ 'fc00::', 7, 'ipv6' ]
];

let roomServers: { raw: string; list: BlockList } | undefined;

const roomServerList = (): BlockList => {
	const raw = process.env.ROOM_SERVER_ADDRESSES?.trim() ?? '';

	if (roomServers?.raw === raw) return roomServers.list;

	const list = new BlockList();

	for (const [ address, bits, type ] of PRIVATE_RANGES) list.addSubnet(address, bits, type);

	for (const item of raw.split(',').map((s) => s.trim())
		.filter(Boolean)) {
		const [ address, prefix, rest ] = item.split('/');
		const type = isIP(address) === 6 ? 'ipv6' : 'ipv4';
		const bits = prefix === undefined ? undefined : Number(prefix);

		if (!isIP(address) || rest !== undefined || (prefix !== undefined && !/^\d{1,3}$/.test(prefix))
			|| (bits !== undefined && bits > (type === 'ipv6' ? 128 : 32))) {
			throw new Error(`ROOM_SERVER_ADDRESSES: "${item}" is not an IP address or CIDR range`);
		}

		if (bits === undefined) list.addAddress(address, type);
		else list.addSubnet(address, bits, type);
	}
	roomServers = { raw, list };

	return list;
};

export const checkRoomServerAddresses = (): void => {
	roomServerList();
};

// BlockList matches an IPv4 address written as IPv6 (::ffff:198.51.100.7) against IPv4 entries.
const isRoomServer = (list: BlockList, address: string): boolean => {
	const type = isIP(address);

	return type !== 0 && list.check(address, type === 6 ? 'ipv6' : 'ipv4');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientAddress = (params: any): string | undefined => {
	if (trustProxy()) {
		const xff = params?.headers?.['x-forwarded-for'];

		if (typeof xff === 'string' && xff.length > 0) {
			const parts = xff
				.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean);

			if (parts.length > 0) return bare(parts[parts.length - 1]);
		}
	}
	const ip = params?.ip;

	if (ip) return bare(String(ip));

	// Never a shared fallback key: ten failures in it would block every password login.
	// app.ts puts the address into params for REST and socket.io, so this is only reached
	// by a transport that does not.
	return undefined;
};

// The super-admin or edumeet-server account this login could sign in to, when its failures are
// also counted per account.
const limitedAccount = async (context: HookContext, address: string): Promise<string | undefined> => {
	const email = context.data?.email;

	if (isRoomServer(roomServerList(), address) || typeof email !== 'string' || !email) return undefined;

	const accounts: { id: unknown; roles: unknown }[] = await context.app.get('postgresqlClient')('users')
		.where({ email })
		.whereNotNull('password')
		.orderBy('id')
		.limit(MAX_ACCOUNTS_PER_EMAIL)
		.select('id', 'roles');
	const account = accounts.find((a) => hasSuperAdminRole(a.roles));

	return account ? String(account.id) : undefined;
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

// Brute-force limit and timing pad for password logins from outside. Failures are counted per
// client address. A limit per account would let anyone who knows an address shut its owner out,
// so there is one only for super-admin and edumeet-server accounts, and never for attempts from
// the room servers' addresses.
export const loginThrottle = async (context: HookContext, next: NextFunction) => {
	if (!context.params.provider || !isLocalLogin(context.data)) return next();

	ensureCleanup();
	const address = clientAddress(context.params);
	const email = extractEmail(context.data);
	const ua = extractUa(context.params);
	const start = Date.now();

	if (!address) {
		logger.warn('login throttle: no client address, attempt not throttled');

		return next();
	}

	const ip = addressKey(address);
	const byAddress = bucketOf(ipState, ip, start);

	// Checking and taking the place happen in one synchronous step, so no other attempt gets in
	// between them.
	if (isFull(byAddress, start)) {
		logger.warn(
			'login throttle: blocked ip=%s email=%s ua=%s retryAfter=%ss',
			ip, email, ua, retryAfter(byAddress, start)
		);
		await padTiming(start);
		throw new TooManyRequests('Too many login attempts');
	}
	byAddress.pending++;

	let byAccount: Bucket | undefined;
	let accountLocked = false;
	const release = () => {
		byAddress.pending--;
		if (byAccount) byAccount.pending--;
	};

	try {
		const account = await limitedAccount(context, address);

		if (account) {
			const now = Date.now();
			const entry = bucketOf(accountState, account, now);

			if (isFull(entry, now)) {
				accountLocked = true;
				logger.warn(
					'login throttle: blocked account=%s ip=%s email=%s ua=%s retryAfter=%ss',
					account, ip, email, ua, retryAfter(entry, now)
				);
				throw new TooManyRequests('Too many login attempts');
			}
			entry.pending++;
			byAccount = entry;
		}

		await next();
		release();
	} catch (error) {
		release();

		const code = (error as { code?: number } | undefined)?.code;

		// Only real credential failures count, and attempts on a locked account, which would
		// otherwise cost a lookup each without ever blocking the address. A 5xx (database blip,
		// internal error) is the server's fault, and the caller did nothing wrong.
		if (code === 401 || accountLocked) {
			const now = Date.now();

			if (addFailure(byAddress, now)) {
				logger.warn(
					'login throttle: tripped ip=%s email=%s ua=%s failures=%d windowMs=%d',
					ip, email, ua, byAddress.failures.length, WINDOW_MS
				);
			} else if (code === 401) {
				logger.warn(
					'login failure ip=%s email=%s ua=%s failures=%d',
					ip, email, ua, byAddress.failures.length
				);
			}

			if (byAccount && addFailure(byAccount, now)) {
				logger.warn(
					'login throttle: account tripped ip=%s email=%s ua=%s failures=%d windowMs=%d',
					ip, email, ua, byAccount.failures.length, WINDOW_MS
				);
			}
		}
		if (code === 401 || code === 429) await padTiming(start);
		throw error;
	}
};
