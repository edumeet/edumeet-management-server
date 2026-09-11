import { randomBytes } from 'crypto';

export const MEETING_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MEETING_TOKEN_LENGTH = 12;

export const generateMeetingToken = (): string => {
	const bytes = randomBytes(MEETING_TOKEN_LENGTH);
	let token = '';

	for (let i = 0; i < MEETING_TOKEN_LENGTH; i++)
		token += MEETING_TOKEN_ALPHABET[bytes[i] % MEETING_TOKEN_ALPHABET.length];

	return token;
};
