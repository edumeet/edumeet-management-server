/* eslint-disable camelcase */
import assert from 'assert';
import qs from 'qs';
import { dynamicOAuth, loadTenantOAuth, reloadTenantOAuth, tenantCallbackUrl } from '../../src/hooks/dynamicOAuth';

type Row = Record<string, unknown>;

const completeRow = (over: Row = {}): Row => ({
	tenantId: 1,
	key: 'client',
	secret: 's1',
	authorize_url: 'https://idp.example/auth',
	access_url: 'https://idp.example/token',
	profile_url: 'https://idp.example/userinfo',
	redirect_uri: null,
	...over
});

// Minimal stand-in for the Feathers app: the OAuth config, the tenantOAuths rows,
// and a counter for how often the oauth service was registered again.
const fakeApp = (rows: Row[], oauth: Record<string, unknown> = {}, settings: Record<string, unknown> = {}) => {
	const config: Record<string, unknown> = { oauth: { defaults: {}, ...oauth } };
	const app = {
		reconfigured: 0,
		get: (name: string) => (name === 'authentication' ? config : settings[name]),
		set: () => app,
		unuse: () => undefined,
		configure: () => { app.reconfigured++; },
		service: (name: string) => {
			if (name === 'tenantOAuths') {
				return {
					find: async ({ query }: { query: { tenantId: number } }) => {
						const data = rows.filter((r) => Number(r.tenantId) === Number(query.tenantId));

						return { total: data.length, data };
					}
				};
			}
			if (name === 'authentication') return { configuration: config };
			if (name === 'tenantFQDNs') return { find: async () => [ { id: 1, fqdn: 'rooms.acme.edu', tenantId: 1 } ] };
			if (name === 'oauth/:provider') return { hooks: () => undefined };
			throw new Error(`unexpected service ${name}`);
		}
	};

	return app;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers = (app: any) => app.get('authentication').oauth;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loginContext = (app: unknown, query: Record<string, unknown>): any => ({
	app,
	params: { headers: {}, query: { ...query }, route: {} }
});

const rejectsWithLocation = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		assert.ok(error.location, `expected a redirect, got: ${error.message}`);

		return error.location;
	}
	assert.fail('expected the hook to throw a redirect');
};

describe('dynamicOAuth', () => {
	describe('tenantCallbackUrl', () => {
		it('uses authentication.oauth.defaults.origin (MGMT_URL) with the "tenant" provider path', () => {
			const app = fakeApp([], { defaults: { origin: 'https://meet.example.org/mgmt' } });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			assert.strictEqual(tenantCallbackUrl(app as any), 'https://meet.example.org/mgmt/oauth/tenant/callback');
		});

		it('falls back to host and port like @feathersjs/authentication-oauth', () => {
			const app = fakeApp([], {}, { host: 'localhost', port: 3030 });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			assert.strictEqual(tenantCallbackUrl(app as any), 'http://localhost:3030/oauth/tenant/callback');
		});
	});

	describe('loadTenantOAuth', () => {
		it('loads a complete configuration with an absolute default redirect_uri', async () => {
			const app = fakeApp([ completeRow() ], { defaults: { origin: 'https://meet.example.org/mgmt' } });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			assert.strictEqual(await loadTenantOAuth(app as any, 1), true);
			assert.strictEqual(providers(app)[1].secret, 's1');
			assert.strictEqual(providers(app)[1].redirect_uri, 'https://meet.example.org/mgmt/oauth/tenant/callback');
			assert.strictEqual(app.reconfigured, 1);
		});

		it('keeps an explicit redirect_uri', async () => {
			const app = fakeApp([ completeRow({ redirect_uri: 'https://x.example/cb' }) ]);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1);
			assert.strictEqual(providers(app)[1].redirect_uri, 'https://x.example/cb');
		});

		it('removes a tenant whose configuration is gone', async () => {
			const app = fakeApp([], { 1: { key: 'old' } });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			assert.strictEqual(await loadTenantOAuth(app as any, 1), false);
			assert.ok(!(1 in providers(app)));
			assert.strictEqual(app.reconfigured, 1);
		});

		it('ignores incomplete rows without touching the oauth service', async () => {
			const app = fakeApp([ completeRow({ secret: '' }) ]);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			assert.strictEqual(await loadTenantOAuth(app as any, 1), false);
			assert.strictEqual(app.reconfigured, 0);
		});
	});

	describe('reloadTenantOAuth (tenantOAuths after hook)', () => {
		it('applies a changed secret without a restart', async () => {
			const rows = [ completeRow() ];
			const app = fakeApp(rows);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1);
			rows[0].secret = 's2';
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await reloadTenantOAuth({ app, result: { id: 1, tenantId: 1 } } as any);
			assert.strictEqual(providers(app)[1].secret, 's2');
		});
	});

	describe('login hook', () => {
		it('loads an unknown tenant and redirects to the same URL instead of failing', async () => {
			const app = fakeApp([ completeRow() ]);
			const location = await rejectsWithLocation(dynamicOAuth(loginContext(app, { tenantId: '1', origin: 'https://rooms.acme.edu' })));

			assert.ok(location.startsWith('?'), 'relative to the current URL, so it works behind a path prefix');
			assert.deepStrictEqual(qs.parse(location.slice(1)), { tenantId: '1', origin: 'https://rooms.acme.edu', oauthReload: '1' });
			assert.ok(providers(app)[1]);
		});

		it('does not loop when the configuration is still missing after the reload', async () => {
			const app = fakeApp([]);
			const location = await rejectsWithLocation(dynamicOAuth(loginContext(app, { tenantId: '1', oauthReload: '1' })));

			assert.ok(location.startsWith('/auth/callback?'));
			assert.strictEqual(qs.parse(location.slice('/auth/callback?'.length)).error, 'Missing OAuth configuration');
		});

		it('shows the error page for a tenant without OAuth configuration', async () => {
			const app = fakeApp([]);
			const location = await rejectsWithLocation(dynamicOAuth(loginContext(app, { tenantId: '1' })));

			assert.ok(location.startsWith('/auth/callback?error='));
		});

		it('continues to the provider for a loaded tenant and drops the reload marker', async () => {
			const app = fakeApp([], { 1: { key: 'client' } });
			const context = loginContext(app, { tenantId: '1', origin: 'https://rooms.acme.edu', oauthReload: '1' });

			await dynamicOAuth(context);
			assert.strictEqual(context.params.route.provider, '1');
			assert.ok(!('oauthReload' in context.params.query));
			assert.strictEqual(context.params.query.origin, 'https://rooms.acme.edu');
		});
	});
});
