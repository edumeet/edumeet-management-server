import assert from 'assert';
import { koa } from '@feathersjs/koa';
import { feathers } from '@feathersjs/feathers';
import { AuthenticationBaseStrategy } from '@feathersjs/authentication';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import { authentication } from '../../src/authentication';
import { tokenTenant } from '../../src/auth/EdumeetAuthenticationService';
import { logger } from '../../src/logger';
import defaults from '../../config/default.json';

const USERS: Record<string, Record<string, unknown>> = {
	1: { id: 1, tenantId: 1, email: 'someone@acme.edu', ssoId: 'sub-1', name: 'Someone', roles: [] },
	2: { id: 2, email: 'admin@gmail.com', roles: [ 'super-admin' ] },
	3: { id: 3, tenantId: 1, email: 'local@acme.edu', name: 'Local', roles: [] },
	4: { id: 4, email: 'no-tenant@acme.edu', name: 'No tenant', roles: [] }
};

class TestStrategy extends AuthenticationBaseStrategy {
	async authenticate(data: { userId: string }) {
		return { authentication: { strategy: 'test' }, user: USERS[data.userId] };
	}
}

const makeApp = () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let rules: any[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const app: any = koa(feathers());

	app.set('host', 'localhost');
	app.set('port', 3030);
	app.set('authentication', {
		...defaults.authentication,
		entityId: 'id',
		authStrategies: [ 'jwt', 'test' ]
	});

	app.use('users', {
		async get(id: string) {
			const user = USERS[id];

			if (!user) throw new NotAuthenticated('No user');

			return user;
		},
		async find() {
			return [];
		}
	});
	app.use('rules', { find: async () => rules });
	app.use('tenantAdmins', { find: async () => [] });
	app.use('tenantOwners', { find: async () => [] });

	app.configure(authentication);
	app.service('authentication').register('test', new TestStrategy());

	return {
		app,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		setRules: (next: any[]) => {
			rules = next;
		}
	};
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signIn = async (app: any, userId: string): Promise<string> => {
	const { accessToken } = await app.service('authentication').create({ strategy: 'test', userId });

	return accessToken;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refresh = async (app: any, accessToken: string): Promise<string> => {
	const { accessToken: next } = await app.service('token-refresh').create({}, {
		provider: 'rest',
		authentication: { strategy: 'jwt', accessToken }
	});

	return next;
};

describe('token-refresh wiring', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('stamps auth_time at sign in and keeps it through refreshes', async () => {
		const { app } = makeApp();
		const first = await signIn(app, '1');
		const firstPayload = await app.service('authentication').verifyAccessToken(first);

		assert.strictEqual(typeof firstPayload.auth_time, 'number');
		assert.strictEqual(firstPayload.sub, '1');

		const second = await refresh(app, first);
		const third = await refresh(app, second);
		const thirdPayload = await app.service('authentication').verifyAccessToken(third);

		assert.strictEqual(thirdPayload.auth_time, firstPayload.auth_time);
		assert.strictEqual(thirdPayload.sub, '1');
	});

	// The room servers compare it with the tenant of the address; a token without it counts
	// there as a guest.
	it('writes the user\'s tenant into the token at sign in and keeps it through refreshes', async () => {
		const { app } = makeApp();
		const verify = (token: string) => app.service('authentication').verifyAccessToken(token);
		const tenantUser = await signIn(app, '1');
		const superAdmin = await signIn(app, '2');

		assert.strictEqual((await verify(tenantUser)).tenantId, 1);
		assert.strictEqual((await verify(await refresh(app, tenantUser))).tenantId, 1);
		assert.ok('tenantId' in await verify(superAdmin));
		assert.strictEqual((await verify(superAdmin)).tenantId, null);
		assert.strictEqual((await verify(await refresh(app, superAdmin))).tenantId, null);
	});

	// null is taken at every tenant, so only the privileged roles get it.
	it('gives any other user without a tenant 0, and writes no tenant without a user', async () => {
		const { app } = makeApp();
		const verify = (token: string) => app.service('authentication').verifyAccessToken(token);
		const noTenant = await signIn(app, '4');

		assert.strictEqual((await verify(noTenant)).tenantId, 0);
		assert.strictEqual((await verify(await refresh(app, noTenant))).tenantId, 0);
		assert.strictEqual(tokenTenant(undefined), undefined);
		assert.strictEqual(tokenTenant({ roles: '["super-admin"]' }), null);
		assert.strictEqual(tokenTenant({ tenantId: '7', roles: [ 'super-admin' ] }), 7);
	});

	it('refuses a refresh without a token before any rule is looked at', async () => {
		const { app } = makeApp();

		await assert.rejects(
			app.service('token-refresh').create({}, { provider: 'rest' }),
			NotAuthenticated
		);
	});

	it('refuses a token issued without auth_time', async () => {
		const { app } = makeApp();
		const legacy = await app.service('authentication').createAccessToken(
			{ sub: '1' },
			app.get('authentication').jwtOptions
		);

		await assert.rejects(refresh(app, legacy), NotAuthenticated);
	});

	it('refuses a tenant user once a rule blocks them', async () => {
		const { app, setRules } = makeApp();
		const token = await signIn(app, '1');

		await refresh(app, token);

		setRules([ {
			id: 1,
			name: 'block acme',
			tenantId: 1,
			type: 'block',
			parameter: 'email',
			method: 'endswith',
			value: '@acme.edu',
			negate: false
		} ]);

		await assert.rejects(refresh(app, token), Forbidden);
	});

	it('refreshes a local tenant account regardless of rules', async () => {
		const { app, setRules } = makeApp();

		setRules([ { id: 1, name: 'everyone', tenantId: 1, type: 'block', parameter: '', method: 'anyone', value: '', negate: false } ]);

		const token = await signIn(app, '3');

		assert.ok(await refresh(app, token));
	});

	it('refreshes a user without a tenant regardless of rules', async () => {
		const { app, setRules } = makeApp();

		setRules([ { id: 1, name: 'everyone', tenantId: 1, type: 'block', parameter: '', method: 'anyone', value: '', negate: false } ]);

		const token = await signIn(app, '2');

		assert.ok(await refresh(app, token));
	});
});
