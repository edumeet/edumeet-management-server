import assert from 'assert';
import { generateKeyPairSync } from 'crypto';

import { assertSigningKeyNotPublished, isPublishedKey } from '../../src/auth/publishedKeys';
import defaultConfig from '../../config/default.json';

const published = defaultConfig.authentication.secret;

describe('published signing key', () => {
	it('recognises the key in config/default.json, however it is wrapped', () => {
		assert.strictEqual(isPublishedKey(published), true);
		assert.strictEqual(isPublishedKey(published.replace(/\n/g, '\r\n')), true);
		assert.strictEqual(isPublishedKey(published.replace(/\n/g, '')), true);
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
