import assert from 'assert';

import { encrypt, decrypt, hmacToken } from '../../src/invites/crypto';

const KEY = 'c'.repeat(64);
const OTHER_KEY = 'd'.repeat(64);

describe('invites crypto', () => {
	describe('encrypt / decrypt', () => {
		it('round-trips a password', () => {
			assert.strictEqual(decrypt(encrypt('s3cret', KEY), KEY), 's3cret');
		});

		it('round-trips non-ASCII and empty values', () => {
			assert.strictEqual(decrypt(encrypt('hasło-ąćę', KEY), KEY), 'hasło-ąćę');
			assert.strictEqual(decrypt(encrypt('', KEY), KEY), '');
		});

		it('produces a different ciphertext every time', () => {
			// a fresh IV per save is why stored passwords cannot be compared by equality
			assert.notStrictEqual(encrypt('same', KEY), encrypt('same', KEY));
		});

		it('never leaks the plaintext into the ciphertext', () => {
			assert.ok(!encrypt('s3cret', KEY).includes('s3cret'));
		});

		it('refuses a key that is not 32 bytes', () => {
			assert.throws(() => encrypt('x', 'abcd'), /32-byte/);
			assert.throws(() => decrypt(encrypt('x', KEY), 'abcd'), /32-byte/);
		});

		it('refuses to decrypt with the wrong key', () => {
			assert.throws(() => decrypt(encrypt('x', KEY), OTHER_KEY));
		});

		it('rejects malformed framing rather than returning garbage', () => {
			assert.throws(() => decrypt('nope', KEY), /invalid ciphertext format/);
			assert.throws(() => decrypt('aa:bb', KEY), /invalid ciphertext format/);
			assert.throws(() => decrypt('aa:bb:cc', KEY), /invalid ciphertext framing/);
		});

		it('detects tampering with the payload', () => {
			const [ iv, tag, enc ] = encrypt('transfer 100', KEY).split(':');
			const flipped = enc.slice(0, -2) + (enc.slice(-2) === 'ff' ? '00' : 'ff');

			assert.throws(() => decrypt(`${iv}:${tag}:${flipped}`, KEY));
		});

		it('detects tampering with the auth tag', () => {
			const [ iv, tag, enc ] = encrypt('transfer 100', KEY).split(':');
			const flipped = tag.slice(0, -2) + (tag.slice(-2) === 'ff' ? '00' : 'ff');

			assert.throws(() => decrypt(`${iv}:${flipped}:${enc}`, KEY));
		});
	});

	describe('hmacToken', () => {
		it('is stable for the same meeting and address', () => {
			assert.strictEqual(hmacToken(1, 'a@b.c', 'secret'), hmacToken(1, 'a@b.c', 'secret'));
		});

		it('ignores address casing, so a reply link works either way', () => {
			assert.strictEqual(hmacToken(1, 'A@B.C', 'secret'), hmacToken(1, 'a@b.c', 'secret'));
		});

		it('differs per meeting, per address and per secret', () => {
			const base = hmacToken(1, 'a@b.c', 'secret');

			assert.notStrictEqual(base, hmacToken(2, 'a@b.c', 'secret'));
			assert.notStrictEqual(base, hmacToken(1, 'x@b.c', 'secret'));
			assert.notStrictEqual(base, hmacToken(1, 'a@b.c', 'other'));
		});

		it('is a hex sha256 digest', () => {
			assert.match(hmacToken(1, 'a@b.c', 'secret'), /^[0-9a-f]{64}$/);
		});

		it('cannot be forged by shifting the separator', () => {
			// "1:a" + "@b.c" must not collide with "1" + ":a@b.c"
			assert.notStrictEqual(hmacToken(1, 'a@b.c', 's'), hmacToken(1, ':a@b.c', 's'));
		});
	});
});
