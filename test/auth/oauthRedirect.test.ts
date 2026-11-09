/* eslint-disable camelcase */
import assert from 'assert';
import qs from 'qs';
import { OAuthStrategy } from '@feathersjs/authentication-oauth/lib';
import OAuthTenantStrategy from '../../src/auth/strategies/OAuthTenantStrategy';
import { consumeCallbackCode } from '../../src/auth/callbackCodes';
import { dynamicOAuth } from '../../src/hooks/dynamicOAuth';

const fakeApp = {
	service: (name: string) => {
		if (name === 'tenantFQDNs') {
			return { find: async () => [ { id: 1, fqdn: 'rooms.acme.edu', tenantId: 1 } ] };
		}

		if (name === 'authentication') {
			return { configuration: { oauth: { 1: {} } } };
		}

		throw new Error(`unexpected service ${name}`);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const makeStrategy = () => {
	const strategy = new OAuthTenantStrategy();

	strategy.setApplication(fakeApp);

	return strategy;
};

const queryOf = (location: string | null) => {
	assert.ok(location);
	assert.ok(location.startsWith('/auth/callback?'));

	return qs.parse(location.slice('/auth/callback?'.length));
};

describe('OAuth tenant redirect', () => {
	it('redirects with a one-time code instead of the tokens', async () => {
		const location = await makeStrategy().getRedirect(
			{ accessToken: 'a.b.c', idToken: 'x.y.z' },
			{ query: { tenantId: '1', origin: 'https://rooms.acme.edu' } }
		);

		assert.ok(!location?.includes('a.b.c'));
		assert.ok(!location?.includes('x.y.z'));

		const { code } = queryOf(location);

		assert.deepStrictEqual(consumeCallbackCode(code), {
			accessToken: 'a.b.c',
			idToken: 'x.y.z',
			origin: 'https://rooms.acme.edu'
		});
	});

	it('turns an origin that fails validation into an error page', async () => {
		const location = await makeStrategy().getRedirect(
			{ accessToken: 'a.b.c' },
			{ query: { tenantId: '1', origin: 'https://evil.example' } }
		);

		assert.ok(!location?.includes('a.b.c'));
		assert.ok(queryOf(location).error);
		assert.strictEqual(queryOf(location).code, undefined);
	});

	it('keeps login errors as an error page', async () => {
		const location = await makeStrategy().getRedirect(new Error('Action not allowed by rule'), { query: { tenantId: '1' } });

		assert.strictEqual(queryOf(location).error, 'Action not allowed by rule');
	});
});

describe('dynamicOAuth origin check', () => {
	const makeContext = (query: Record<string, unknown>) => ({
		app: fakeApp,
		params: { headers: {}, query, route: {} as Record<string, unknown> }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);

	it('lets a registered origin start the sign in', async () => {
		const context = makeContext({ tenantId: '1', origin: 'https://rooms.acme.edu' });

		await dynamicOAuth(context);

		assert.strictEqual(context.params.query.origin, 'https://rooms.acme.edu');
		assert.strictEqual(context.params.route.provider, '1');
	});

	for (const origin of [ undefined, 'https://evil.example' ]) {
		it(`stops the sign in before the identity provider for origin ${origin}`, async () => {
			const context = makeContext({ tenantId: '1', origin });

			await assert.rejects(dynamicOAuth(context), (error: Error & { location?: string }) => {
				assert.ok(error.location?.startsWith('/auth/callback?error='));

				return true;
			});
			assert.strictEqual(context.params.route.provider, undefined);
		});
	}
});

describe('OAuth tenant callback', () => {
	// eslint-disable-next-line no-unused-vars
	const withUsers = (byQuery: (query: Record<string, unknown>) => unknown[]) => {
		const strategy = makeStrategy();

		Object.defineProperty(strategy, 'entityService', {
			value: { find: async ({ query }: { query: Record<string, unknown> }) => byQuery(query) }
		});

		return strategy;
	};

	const victim = { id: 7, tenantId: 1, email: 'admin@acme.edu', ssoId: 'old' };
	const byEmail = (query: Record<string, unknown>) => (query.email === victim.email ? [ victim ] : []);

	it('refuses a callback whose grant provider is not the tenant being signed in to', async () => {
		for (const session of [ {}, { grant: { provider: 'tenant' } }, { grant: { provider: '2' } } ]) {
			await assert.rejects(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				makeStrategy().authenticate({ strategy: 'tenant' }, { query: { tenantId: '1' }, session } as any),
				/OAuth provider does not match tenant/
			);
		}
		await assert.rejects(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			makeStrategy().authenticate({ strategy: 'tenant' }, { query: { tenantId: '1e1' }, session: { grant: { provider: '1e1' } } } as any),
			/OAuth provider does not match tenant/
		);
	});

	it('signs in when the grant provider is the tenant being signed in to', async () => {
		const original = OAuthStrategy.prototype.authenticate;

		OAuthStrategy.prototype.authenticate = async () => ({ accessToken: 'a.b.c', authentication: { strategy: 'tenant' } });
		try {
			const result = await makeStrategy().authenticate(
				{ strategy: 'tenant', id_token: 'x.y.z' },
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ query: { tenantId: '1' }, session: { grant: { provider: '1' } } } as any
			);

			assert.deepStrictEqual(result, { accessToken: 'a.b.c', authentication: { strategy: 'tenant' }, idToken: 'x.y.z' });
		} finally {
			OAuthStrategy.prototype.authenticate = original;
		}
	});

	it('links an existing account by e-mail only when the address is verified', async () => {
		const params = { query: { tenantId: '1' } };

		assert.strictEqual(await withUsers(byEmail).findEntity({ sub: 'new', email: victim.email }, params), null);
		assert.strictEqual(
			await withUsers(byEmail).findEntity({ sub: 'new', email: victim.email, email_verified: false }, params),
			null
		);
		assert.strictEqual(
			await withUsers(byEmail).findEntity({ sub: 'new', email: victim.email, email_verified: true }, params),
			victim
		);
	});
});
