import assert from 'assert';
import { CALLBACK_CODE_TTL_MS, consumeCallbackCode, issueCallbackCode } from '../../src/auth/callbackCodes';

const ENTRY = { accessToken: 'jwt', idToken: 'id', origin: 'https://rooms.acme.edu' };

describe('callback codes', () => {
	it('returns the entry once and never again', () => {
		const code = issueCallbackCode(ENTRY);

		assert.deepStrictEqual(consumeCallbackCode(code), ENTRY);
		assert.strictEqual(consumeCallbackCode(code), undefined);
	});

	it('issues long random codes that are safe in a URL', () => {
		const a = issueCallbackCode(ENTRY);
		const b = issueCallbackCode(ENTRY);

		assert.notStrictEqual(a, b);
		assert.match(a, /^[A-Za-z0-9_-]{43}$/);
		consumeCallbackCode(a);
		consumeCallbackCode(b);
	});

	it('refuses an expired code', () => {
		const now = Date.now();
		const code = issueCallbackCode(ENTRY, now);

		assert.strictEqual(consumeCallbackCode(code, now + CALLBACK_CODE_TTL_MS), undefined);
		assert.strictEqual(consumeCallbackCode(code, now), undefined, 'an expired code is gone for good');
	});

	it('accepts a code just before it expires', () => {
		const now = Date.now();
		const code = issueCallbackCode(ENTRY, now);

		assert.deepStrictEqual(consumeCallbackCode(code, now + CALLBACK_CODE_TTL_MS - 1), ENTRY);
	});

	it('drops expired codes when a new one is issued', () => {
		const now = Date.now();
		const old = issueCallbackCode(ENTRY, now);

		issueCallbackCode(ENTRY, now + CALLBACK_CODE_TTL_MS);

		assert.strictEqual(consumeCallbackCode(old, now), undefined);
	});

	it('refuses unknown and non-string codes', () => {
		assert.strictEqual(consumeCallbackCode('nope'), undefined);
		assert.strictEqual(consumeCallbackCode(undefined), undefined);
		assert.strictEqual(consumeCallbackCode([ 'a', 'b' ]), undefined);
	});
});
