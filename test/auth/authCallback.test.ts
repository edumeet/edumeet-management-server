import assert from 'assert';
import { handleAuthCallback, AuthCallbackContext } from '../../src/authCallback';
import { issueCallbackCode } from '../../src/auth/callbackCodes';

const makeCtx = (query: Record<string, unknown>) => {
	const headers: Record<string, string> = {};
	const ctx: AuthCallbackContext & { headers: Record<string, string> } = {
		request: { query },
		status: 404,
		body: undefined,
		headers,
		set: (field: string, value: string) => {
			headers[field] = value;
		}
	};

	return ctx;
};

describe('auth callback page', () => {
	it('posts the tokens only to the origin that started the sign in', () => {
		const code = issueCallbackCode({ accessToken: 'a.b.c', idToken: 'x.y.z', origin: 'https://rooms.acme.edu' });
		const ctx = makeCtx({ code });

		handleAuthCallback(ctx);

		const body = String(ctx.body);

		assert.strictEqual(ctx.status, 200);
		assert.strictEqual(ctx.headers['Cache-Control'], 'no-store');
		assert.ok(body.includes('"a.b.c"'));
		assert.ok(body.includes('"x.y.z"'));
		assert.ok(body.includes('}, "https://rooms.acme.edu");'));
		assert.ok(!body.includes('\'*\''));
		assert.ok(!body.includes('"*"'));
		assert.ok(body.includes('if (window.opener)'));
	});

	it('refuses the same code a second time', () => {
		const code = issueCallbackCode({ accessToken: 'a.b.c', origin: 'https://rooms.acme.edu' });

		handleAuthCallback(makeCtx({ code }));

		const again = makeCtx({ code });

		handleAuthCallback(again);

		assert.strictEqual(again.status, 400);
		assert.ok(!String(again.body).includes('a.b.c'));
		assert.strictEqual(again.headers['Cache-Control'], 'no-store');
	});

	it('refuses a missing or unknown code', () => {
		// eslint-disable-next-line camelcase
		for (const query of [ {}, { code: 'nope' }, { code: [ 'a', 'b' ] }, { access_token: 'a.b.c' } ]) {
			const ctx = makeCtx(query);

			handleAuthCallback(ctx);

			assert.strictEqual(ctx.status, 400);
			assert.ok(!String(ctx.body).includes('postMessage'));
		}
	});

	it('cannot be broken out of the script by a token value', () => {
		const code = issueCallbackCode({
			accessToken: '</script><script>alert(1)</script>',
			origin: 'https://rooms.acme.edu'
		});
		const ctx = makeCtx({ code });

		handleAuthCallback(ctx);

		assert.strictEqual((String(ctx.body).match(/<\/script>/g) ?? []).length, 1);
	});

	it('shows a sanitized error message', () => {
		const ctx = makeCtx({ error: 'Action not allowed by rule<img src=x onerror=alert(1)>' });

		handleAuthCallback(ctx);

		assert.strictEqual(ctx.status, 200);
		assert.ok(String(ctx.body).includes('Action not allowed by rule'));
		assert.ok(!String(ctx.body).includes('onerror'));
		assert.ok(!String(ctx.body).includes('postMessage'));
	});
});
