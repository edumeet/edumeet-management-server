import { TooManyRequests } from '@feathersjs/errors';
import { HookContext } from '../declarations';
import { logger } from '../logger';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const TIMING_PAD_MS = 400;
const CLEANUP_INTERVAL_MS = 60 * 1000;

// When TRUST_PROXY=true, the management server is behind a reverse proxy
// (nginx in the docker stack, or nginx-on-host) that appends the real client
// IP to X-Forwarded-For via `$proxy_add_x_forwarded_for`. The RIGHTMOST entry
// is what the proxy itself observed as the connection peer, and is the only
// entry not forgeable by the client. Leftmost entries are client-supplied
// and must never be trusted.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

interface IpEntry {
	failures: number[];
	blockedUntil: number;
}

const ipState = new Map<string, IpEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const ensureCleanup = () => {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();

		for (const [ ip, entry ] of ipState) {
			entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);
			if (entry.failures.length === 0 && entry.blockedUntil <= now) {
				ipState.delete(ip);
			}
		}
	}, CLEANUP_INTERVAL_MS);
	cleanupTimer.unref?.();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractIp = (params: any): string => {
	if (TRUST_PROXY) {
		const xff = params?.headers?.['x-forwarded-for'];

		if (typeof xff === 'string' && xff.length > 0) {
			const parts = xff
				.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean);

			if (parts.length > 0) return parts[parts.length - 1];
		}
	}
	const ip = params?.ip;

	if (ip) return String(ip);

	return 'unknown';
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

export const loginThrottleBefore = async (context: HookContext) => {
	if (!context.params.provider) return;
	if (!isLocalLogin(context.data)) return;

	ensureCleanup();
	const ip = extractIp(context.params);
	const now = Date.now();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(context.params as any)._loginStart = now;

	const entry = ipState.get(ip);

	if (entry && entry.blockedUntil > now) {
		const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);

		logger.warn(
			'login throttle: blocked ip=%s email=%s ua=%s retryAfter=%ss',
			ip, extractEmail(context.data), extractUa(context.params), retryAfter
		);
		await padTiming(now);
		throw new TooManyRequests('Too many login attempts');
	}
};

export const loginThrottleError = async (context: HookContext) => {
	if (!context.params.provider) return;
	if (!isLocalLogin(context.data)) return;

	// Don't double-count throttle rejections we threw ourselves.
	const errCode = (context.error as { code?: number } | undefined)?.code;

	if (errCode === 429) return;

	const ip = extractIp(context.params);
	const email = extractEmail(context.data);
	const ua = extractUa(context.params);
	const now = Date.now();

	ensureCleanup();
	let entry = ipState.get(ip);

	if (!entry) {
		entry = { failures: [], blockedUntil: 0 };
		ipState.set(ip, entry);
	}
	entry.failures = entry.failures.filter((t) => now - t < WINDOW_MS);
	entry.failures.push(now);

	if (entry.failures.length >= MAX_FAILURES) {
		entry.blockedUntil = now + WINDOW_MS;
		logger.warn(
			'login throttle: tripped ip=%s email=%s ua=%s failures=%d windowMs=%d',
			ip, email, ua, entry.failures.length, WINDOW_MS
		);
	} else {
		logger.warn(
			'login failure ip=%s email=%s ua=%s failures=%d',
			ip, email, ua, entry.failures.length
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const start = (context.params as any)._loginStart ?? now;

	await padTiming(start);
};
