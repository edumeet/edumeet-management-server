import { createHash } from 'crypto';
import { BlockList, isIP } from 'net';

export type BotPolicy = 'disabled' | 'tokenOnly' | 'all';
export const botPolicies: BotPolicy[] = [ 'disabled', 'tokenOnly', 'all' ];

export type BotRejection = 'botsNotAllowed' | 'botTokenRejected';

export type BotJobType = 'recorder' | 'transcriber' | 'streamer';
export const botJobTypes: BotJobType[] = [ 'recorder', 'transcriber', 'streamer' ];

export const isBotJobType = (value: unknown): value is BotJobType =>
	typeof value === 'string' && (botJobTypes as string[]).includes(value);

// The set of job types a row offers, from the column's JSON or from a request: the
// known ones, each once, in a fixed order. Anything else reads as none.
export const asBotJobTypes = (value: unknown): BotJobType[] => {
	let list: unknown = value;

	if (typeof list === 'string') {
		try {
			list = JSON.parse(list);
		} catch {
			return [];
		}
	}

	if (!Array.isArray(list)) return [];

	return botJobTypes.filter((type) => (list as unknown[]).includes(type));
};

export type BotVerdict =
	| { allowed: true; verified: false }
	| { allowed: true; verified: true; label: string; credentialId: number; jobTypes?: BotJobType[] }
	| { allowed: false; reason: BotRejection };

export interface BotCredentialLike {
	id: number;
	label: string;
	tokenHash: string;
	allowedIps: string[];
	enabled?: boolean | number | null;
	jobTypes?: string | string[] | null;
}

export const hashBotToken = (token: string): string =>
	createHash('sha256')
		.update(token, 'utf8')
		.digest('hex');

export const isTokenHash = (value: unknown): value is string =>
	typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

interface Range {
	address: string;
	prefix: number;
	family: 'ipv4' | 'ipv6';
}

// "10.0.0.5", "10.0.0.0/8", "2001:db8::1" or "2001:db8::/32"; nothing else.
export const parseRange = (range: string): Range | undefined => {
	const [ address, prefixText, ...rest ] = range.trim().split('/');

	if (rest.length > 0 || !address) return undefined;

	const version = isIP(address);

	if (version === 0) return undefined;

	const family = version === 4 ? 'ipv4' : 'ipv6';
	const bits = family === 'ipv4' ? 32 : 128;

	if (prefixText === undefined) return { address, prefix: bits, family };
	if (!/^\d{1,3}$/.test(prefixText)) return undefined;

	const prefix = Number(prefixText);

	if (prefix > bits) return undefined;

	return { address, prefix, family };
};

export const invalidRanges = (ranges: string[]): string[] => ranges.filter((range) => !parseRange(range));

// A client behind an IPv6 socket often arrives as "::ffff:1.2.3.4"; ranges are
// written as plain IPv4, so the address is folded back before matching.
const normalizeAddress = (address: string): string => {
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address.trim());

	return mapped ? mapped[1] : address.trim();
};

export const addressAllowed = (ranges: string[], address: string): boolean => {
	const candidate = normalizeAddress(address);
	const version = isIP(candidate);

	if (version === 0) return false;

	const list = new BlockList();

	for (const range of ranges) {
		const parsed = parseRange(range);

		if (parsed) list.addSubnet(parsed.address, parsed.prefix, parsed.family);
	}

	return list.check(candidate, version === 4 ? 'ipv4' : 'ipv6');
};

export const decideBot = ({ policy, botToken, address, credentials }: {
	policy: BotPolicy | string | null | undefined;
	botToken?: string;
	address: string;
	credentials: BotCredentialLike[];
}): BotVerdict => {
	if (policy !== 'tokenOnly' && policy !== 'all') return { allowed: false, reason: 'botsNotAllowed' };

	if (!botToken) {
		return policy === 'all' ? { allowed: true, verified: false } : { allowed: false, reason: 'botsNotAllowed' };
	}

	const tokenHash = hashBotToken(botToken);
	const credential = credentials.find((c) => c.tokenHash === tokenHash);

	// One answer for every credential failure: the caller must not learn which
	// of the token, the enabled flag or the address was the problem.
	if (!credential || !credential.enabled || !addressAllowed(credential.allowedIps, address))
		return { allowed: false, reason: 'botTokenRejected' };

	return {
		allowed: true,
		verified: true,
		label: credential.label,
		credentialId: Number(credential.id),
		...(asBotJobTypes(credential.jobTypes).length > 0 ? { jobTypes: asBotJobTypes(credential.jobTypes) } : {})
	};
};
