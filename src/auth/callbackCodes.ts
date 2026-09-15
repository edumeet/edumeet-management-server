import { randomBytes } from 'crypto';

export interface CallbackEntry {
	accessToken: string;
	idToken?: string;
	origin: string;
}

export const CALLBACK_CODE_TTL_MS = 60_000;

const entries = new Map<string, CallbackEntry & { expires: number }>();

export const issueCallbackCode = (entry: CallbackEntry, now = Date.now()): string => {
	for (const [ code, stored ] of entries) {
		if (stored.expires <= now) entries.delete(code);
	}

	const code = randomBytes(32).toString('base64url');

	entries.set(code, { ...entry, expires: now + CALLBACK_CODE_TTL_MS });

	return code;
};

export const consumeCallbackCode = (code: unknown, now = Date.now()): CallbackEntry | undefined => {
	if (typeof code !== 'string') return undefined;

	const stored = entries.get(code);

	if (!stored) return undefined;

	entries.delete(code);

	if (stored.expires <= now) return undefined;

	return { accessToken: stored.accessToken, idToken: stored.idToken, origin: stored.origin };
};
