/* eslint-disable camelcase */
import assert from 'assert';
import qs from 'qs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import grant from 'grant/lib/grant';
import {
	dynamicOAuth,
	loadTenantOAuth,
	oauthCallbackHooks,
	oauthServiceHooks,
	rejectOAuthConnect,
	rememberOAuthTenants,
	requireOAuthCode,
	reloadTenantOAuth,
	tenantCallbackUrl
} from '../../src/hooks/dynamicOAuth';

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
// find() takes a snapshot of the rows when called and then waits findDelays.shift() ms,
// like a database read that is slow to come back.
const fakeApp = (rows: Row[], oauth: Record<string, unknown> = {}, settings: Record<string, unknown> = {}) => {
	const config: Record<string, unknown> = { oauth: { defaults: {}, ...oauth } };
	const app = {
		reconfigured: 0,
		findDelays: [] as number[],
		get: (name: string) => (name === 'authentication' ? config : settings[name]),
		set: () => app,
		unuse: () => undefined,
		configure: () => { app.reconfigured++; },
		service: (name: string) => {
			if (name === 'tenantOAuths') {
				return {
					find: async ({ query }: { query: { tenantId: number } }) => {
						const data = rows.filter((r) => Number(r.tenantId) === Number(query.tenantId)).map((r) => ({ ...r }));

						await new Promise((resolve) => setTimeout(resolve, app.findDelays.shift() ?? 0));

						return { total: data.length, data };
					}
				};
			}
			if (name === 'authentication') return { configuration: config };
			if (name === 'tenantFQDNs') return { find: async () => [ { id: 1, fqdn: 'rooms.acme.edu', tenantId: 1 } ] };
			if (name === 'oauth/:provider' || name === 'oauth/:provider/callback') return { hooks: () => undefined };
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

	describe('concurrent refreshes', () => {
		it('a slow earlier read does not overwrite a newer configuration', async () => {
			const rows = [ completeRow({ secret: 'old' }) ];
			const app = fakeApp(rows);

			app.findDelays = [ 50, 0 ]; // the first read comes back last
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const first = loadTenantOAuth(app as any, 1);

			await new Promise((resolve) => setTimeout(resolve, 0));

			rows[0].secret = 'new';
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const second = loadTenantOAuth(app as any, 1);

			await Promise.all([ first, second ]);
			assert.strictEqual(providers(app)[1].secret, 'new');
		});
	});

	describe('rememberOAuthTenants + reloadTenantOAuth (tenantOAuths hooks)', () => {
		// a tenantOAuths service with the adapter methods the before hook uses
		const tenantOAuthsService = (rows: Row[]) => ({
			_get: async (id: number) => {
				const row = rows.find((r) => r.id === id);

				if (!row) throw new Error('NotFound');

				return { ...row };
			},
			_find: async () => rows.map((r) => ({ ...r }))
		});

		it('reloads the tenant even when $select leaves tenantId out of the result', async () => {
			const rows = [ completeRow({ id: 7, secret: 'old' }) ];
			const app = fakeApp(rows);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const context: any = { app, service: tenantOAuthsService(rows), id: 7, params: { query: { $select: [ 'id' ] } }, data: { secret: 'new' } };

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1);
			await rememberOAuthTenants(context);
			rows[0].secret = 'new'; // the patch itself
			context.result = { id: 7 };
			await reloadTenantOAuth(context);
			assert.strictEqual(providers(app)[1].secret, 'new');
		});

		it('reloads both tenants when a patch moves the entry to another tenant', async () => {
			const rows = [ completeRow({ id: 7, tenantId: 1 }) ];
			const app = fakeApp(rows);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const context: any = { app, service: tenantOAuthsService(rows), id: 7, params: { query: {} }, data: { tenantId: 2 } };

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1);
			await rememberOAuthTenants(context);
			rows[0].tenantId = 2;
			context.result = { id: 7, tenantId: 2 };
			await reloadTenantOAuth(context);
			assert.ok(!(1 in providers(app)), 'old tenant no longer has the provider');
			assert.ok(providers(app)[2], 'new tenant has it');
		});

		it('removes the provider after a remove with $select', async () => {
			const rows = [ completeRow({ id: 7 }) ];
			const app = fakeApp(rows);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const context: any = { app, service: tenantOAuthsService(rows), id: 7, params: { query: { $select: [ 'id' ] } } };

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1);
			await rememberOAuthTenants(context);
			rows.length = 0;
			context.result = { id: 7 };
			await reloadTenantOAuth(context);
			assert.ok(!(1 in providers(app)));
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

	describe('provider overrides from the request', () => {
		it('refuses get and create on the oauth service, which would skip the login hook', async () => {
			const hooks = oauthServiceHooks();

			assert.deepStrictEqual(hooks.before.get, [ rejectOAuthConnect ]);
			assert.deepStrictEqual(hooks.before.create, [ rejectOAuthConnect ]);
			assert.deepStrictEqual(hooks.before.find, [ dynamicOAuth ]);

			const location = await rejectsWithLocation(rejectOAuthConnect());

			assert.ok(location.startsWith('/auth/callback?error='));
		});

		it('loads tenant providers with request overrides switched off', async () => {
			const app = fakeApp([ completeRow() ], { defaults: { dynamic: true } });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1);
			assert.strictEqual(providers(app)[1].dynamic, false);
		});

		it('grant ignores endpoint and credential overrides in the query for a tenant provider', async () => {
			const app = fakeApp([ completeRow() ], { defaults: { origin: 'https://meet.example.org', dynamic: true, state: true } });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await loadTenantOAuth(app as any, 1, false);

			const result = await grant({ config: providers(app) })({
				method: 'GET',
				params: { provider: '1' },
				query: {
					tenantId: '1',
					key: 'evil',
					secret: 'evil',
					authorize_url: 'https://evil.example/auth',
					access_url: 'https://evil.example/token',
					profile_url: 'https://evil.example/me'
				},
				state: {},
				session: {}
			});

			assert.ok(String(result.location).startsWith('https://idp.example/auth?'), result.location);
			assert.ok(String(result.location).includes('client_id=client'));
			assert.ok(!String(result.location).includes('evil'));
		});
	});

	describe('tenantId format', () => {
		for (const tenantId of [ '1e1', '01', '0b1', ' 1', '1.0', 'tenant', '__proto__', [ '1' ] ]) {
			it(`refuses ${JSON.stringify(tenantId)} before loading anything`, async () => {
				const app = fakeApp([ completeRow({ tenantId: 10 }), completeRow() ]);
				const location = await rejectsWithLocation(dynamicOAuth(loginContext(app, { tenantId, origin: 'https://rooms.acme.edu' })));

				assert.ok(location.startsWith('/auth/callback?error='));
				assert.strictEqual(app.reconfigured, 0);
			});
		}
	});

	describe('account linking', () => {
		it('drops feathers_token so a sign in link cannot attach to another account', async () => {
			const app = fakeApp([], { 1: { key: 'client' } });
			const context = loginContext(app, { tenantId: '1', origin: 'https://rooms.acme.edu', feathers_token: 'attacker.jwt' });

			await dynamicOAuth(context);
			assert.ok(!('feathers_token' in context.params.query));
		});

		it('drops feathers_token from the reload redirect too', async () => {
			const app = fakeApp([ completeRow() ]);
			const location = await rejectsWithLocation(
				dynamicOAuth(loginContext(app, { tenantId: '1', origin: 'https://rooms.acme.edu', feathers_token: 'attacker.jwt' }))
			);

			assert.ok(!location.includes('attacker.jwt'));
		});
	});

	describe('callback input', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const callbackContext = (query: Record<string, unknown>, data?: Record<string, unknown>): any => ({
			params: { query },
			data
		});

		it('guards both callback methods', () => {
			assert.deepStrictEqual(oauthCallbackHooks().before, { find: [ requireOAuthCode ], create: [ requireOAuthCode ] });
		});

		it('lets an authorization code or an identity provider error through', async () => {
			await requireOAuthCode(callbackContext({ code: 'c', state: 's' }));
			await requireOAuthCode(callbackContext({}, { code: 'c', state: 's' }));
			await requireOAuthCode(callbackContext({ error: 'access_denied' }));
		});

		it('refuses a callback without a code, or with tokens the browser supplied', async () => {
			for (const [ query, data ] of [
				[ {} ],
				[ { access_token: 'stolen' } ],
				[ { code: 'c', access_token: 'stolen' } ],
				[ { error: 'x', id_token: 'forged' } ],
				[ { code: [ 'c' ] } ],
				[ {}, { access_token: 'stolen' } ]
			] as Array<[Record<string, unknown>, Record<string, unknown>?]>) {
				const location = await rejectsWithLocation(requireOAuthCode(callbackContext(query, data)));

				assert.ok(location.startsWith('/auth/callback?error='), JSON.stringify(query));
			}
		});
	});
});
