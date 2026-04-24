import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const normalizeKey = (hexKey: string): Buffer => {
	const buf = Buffer.from(hexKey, 'hex');

	if (buf.length !== 32)
		throw new Error('invites.encryptionKey must be a 32-byte (64 hex char) value');

	return buf;
};

export const encrypt = (plaintext: string, hexKey: string): string => {
	const key = normalizeKey(hexKey);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const enc = Buffer.concat([ cipher.update(plaintext, 'utf8'), cipher.final() ]);
	const tag = cipher.getAuthTag();

	return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

export const decrypt = (ciphertext: string, hexKey: string): string => {
	const parts = ciphertext.split(':');

	if (parts.length !== 3)
		throw new Error('invalid ciphertext format');

	const [ ivHex, tagHex, encHex ] = parts;
	const iv = Buffer.from(ivHex, 'hex');
	const tag = Buffer.from(tagHex, 'hex');
	const enc = Buffer.from(encHex, 'hex');

	if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH)
		throw new Error('invalid ciphertext framing');

	const key = normalizeKey(hexKey);
	const decipher = createDecipheriv(ALGORITHM, key, iv);

	decipher.setAuthTag(tag);
	const dec = Buffer.concat([ decipher.update(enc), decipher.final() ]);

	return dec.toString('utf8');
};

export const hmacToken = (meetingId: number, email: string, secret: string): string => {
	return createHmac('sha256', secret)
		.update(`${meetingId}:${email.toLowerCase()}`)
		.digest('hex');
};
