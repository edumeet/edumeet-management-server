import assert from 'assert';
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'crypto';

import { assertSigningKeyNotPublished, isPublishedKey } from '../../src/auth/publishedKeys';
import defaultConfig from '../../config/default.json';

const published = defaultConfig.authentication.secret;

describe('published signing key', () => {
	it('recognises the key in config/default.json in any format', () => {
		const key = createPrivateKey(published);

		assert.strictEqual(isPublishedKey(published), true);
		assert.strictEqual(isPublishedKey(published.replace(/\n/g, '\r\n')), true);
		assert.strictEqual(isPublishedKey(key.export({ type: 'pkcs1', format: 'pem' }).toString()), true);
		assert.strictEqual(isPublishedKey(createPublicKey(key).export({ type: 'spki', format: 'pem' })
			.toString()), true);
	});

	it('does not mistake a secret that is no key for it', () => {
		assert.strictEqual(isPublishedKey('an-hmac-secret'), false);
	});

	it('refuses to start with it outside the test suite', () => {
		assert.throws(() => assertSigningKeyNotPublished(published, 'production'), /published with eduMeet/);
		assert.throws(() => assertSigningKeyNotPublished(published, 'development'), /published with eduMeet/);
		assert.doesNotThrow(() => assertSigningKeyNotPublished(published, 'test'));
	});

	it('accepts a new key', () => {
		const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
		const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

		assert.strictEqual(isPublishedKey(pem), false);
		assert.doesNotThrow(() => assertSigningKeyNotPublished(pem, 'production'));
	});
});
