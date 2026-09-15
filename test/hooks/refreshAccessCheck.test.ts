import assert from 'assert';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import { refreshAccessCheck, sessionMaxAgeSeconds } from '../../src/hooks/refreshAccessCheck';
import { EdumeetAuthenticationService } from '../../src/auth/EdumeetAuthenticationService';
import { logger } from '../../src/logger';

const DAY = 24 * 60 * 60;

const BLOCK_GMAIL = [
	{
		id: 1,
		name: 'no gmail',
		tenantId: 1,
		type: 'block',
		parameter: 'email',
		method: 'endswith',
		value: '@gmail.com',
		negate: false
	}
];

interface Options {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	rules?: any[];
	admins?: { tenantId: number; userId: number }[];
	maxDays?: unknown;
}

const makeApp = ({ rules = [], admins = [], maxDays }: Options = {}) => {
	const services: string[] = [];
	const app = {
		get: (key: string) => (key === 'authSessionMaxDays' ? maxDays : undefined),
		service: (name: string) => {
			services.push(name);

			if (name === 'rules') return { find: async () => rules };
			if (name === 'tenantAdmins') {
				return {
					find: async ({ query }: { query: { tenantId: number; userId: number } }) =>
						admins.filter((a) => a.tenantId === query.tenantId && a.userId === query.userId)
				};
			}
			if (name === 'tenantOwners') return { find: async () => [] };
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { app, services };
};

const now = () => Math.floor(Date.now() / 1000);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeContext = (app: any, user: any, ...authTime: unknown[]) => ({
	app,
	params: {
		user,
		authentication: {
			strategy: 'jwt',
			// eslint-disable-next-line camelcase
			payload: { sub: String(user?.id), auth_time: authTime.length ? authTime[0] : now() - 60 }
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

const TENANT_USER = { id: 7, tenantId: 1, email: 'someone@gmail.com', ssoId: 'sub-7', name: 'Someone', roles: [] };

describe('token refresh access check', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('lets a tenant user of a tenant with no rules refresh, with one rules lookup', async () => {
		const { app, services } = makeApp();

		await refreshAccessCheck(makeContext(app, TENANT_USER));
		assert.deepStrictEqual(services, [ 'rules' ]);
	});

	it('lets a tenant user the rules admit refresh', async () => {
		const { app } = makeApp({ rules: BLOCK_GMAIL });

		await refreshAccessCheck(makeContext(app, { ...TENANT_USER, email: 'someone@acme.edu' }));
	});

	it('refuses a tenant user the rules now block', async () => {
		const { app } = makeApp({ rules: BLOCK_GMAIL });

		await assert.rejects(refreshAccessCheck(makeContext(app, TENANT_USER)), Forbidden);
	});

	it('evaluates rules against the stored ssoId and name', async () => {
		const { app } = makeApp({
			rules: [ { ...BLOCK_GMAIL[0], parameter: 'ssoId', method: 'equals', value: 'sub-7' } ]
		});

		await assert.rejects(refreshAccessCheck(makeContext(app, { ...TENANT_USER, email: 'x@acme.edu' })), Forbidden);
	});

	it('handles a tenant id stored as a string', async () => {
		const { app } = makeApp({ rules: BLOCK_GMAIL });

		await assert.rejects(refreshAccessCheck(makeContext(app, { ...TENANT_USER, tenantId: '1' })), Forbidden);
	});

	it('lets a tenant admin refresh through a rule that would block them', async () => {
		const { app } = makeApp({ rules: BLOCK_GMAIL, admins: [ { tenantId: 1, userId: 7 } ] });

		await refreshAccessCheck(makeContext(app, TENANT_USER));
	});

	it('does not look at rules for a local account without an ssoId, as at its sign in', async () => {
		const { app, services } = makeApp({ rules: BLOCK_GMAIL });

		await refreshAccessCheck(makeContext(app, { ...TENANT_USER, ssoId: undefined }));
		await refreshAccessCheck(makeContext(app, { ...TENANT_USER, ssoId: null }));
		await refreshAccessCheck(makeContext(app, { ...TENANT_USER, ssoId: '' }));
		assert.deepStrictEqual(services, []);
	});

	it('still ends a local account session at the maximum age', async () => {
		const { app } = makeApp();

		await assert.rejects(
			refreshAccessCheck(makeContext(app, { ...TENANT_USER, ssoId: undefined }, now() - (30 * DAY) - 60)),
			NotAuthenticated
		);
	});

	it('does not look at rules for a user without a tenant', async () => {
		const { app, services } = makeApp({ rules: BLOCK_GMAIL });

		await refreshAccessCheck(makeContext(app, { id: 1, email: 'admin@gmail.com', roles: [ 'super-admin' ] }));
		await refreshAccessCheck(makeContext(app, { id: 2, tenantId: null, email: 'server@gmail.com' }));
		assert.deepStrictEqual(services, []);
	});

	it('refuses a token without auth_time', async () => {
		const { app, services } = makeApp();

		await assert.rejects(refreshAccessCheck(makeContext(app, TENANT_USER, undefined)), NotAuthenticated);
		await assert.rejects(refreshAccessCheck(makeContext(app, TENANT_USER, null)), NotAuthenticated);
		await assert.rejects(refreshAccessCheck(makeContext(app, TENANT_USER, '1700000000')), NotAuthenticated);
		assert.deepStrictEqual(services, []);
	});

	it('refuses a session older than the maximum age, for every user', async () => {
		const { app } = makeApp();
		const old = now() - (30 * DAY) - 60;

		await assert.rejects(refreshAccessCheck(makeContext(app, TENANT_USER, old)), NotAuthenticated);
		await assert.rejects(refreshAccessCheck(makeContext(app, { id: 1, roles: [ 'super-admin' ] }, old)), NotAuthenticated);
	});

	it('allows a session just inside the maximum age', async () => {
		const { app } = makeApp();

		await refreshAccessCheck(makeContext(app, TENANT_USER, now() - (30 * DAY) + 60));
	});

	it('honours a configured maximum age', async () => {
		const { app } = makeApp({ maxDays: 0.01 });

		assert.strictEqual(sessionMaxAgeSeconds(app), 864);
		await refreshAccessCheck(makeContext(app, TENANT_USER, now() - 800));
		await assert.rejects(refreshAccessCheck(makeContext(app, TENANT_USER, now() - 900)), NotAuthenticated);
	});

	it('falls back to 30 days for a missing or invalid maximum age', () => {
		for (const maxDays of [ undefined, 0, -1, '7' ]) {
			assert.strictEqual(sessionMaxAgeSeconds(makeApp({ maxDays }).app), 30 * DAY);
		}
	});

	it('refuses a request without a user', async () => {
		const { app } = makeApp();

		await assert.rejects(refreshAccessCheck(makeContext(app, undefined)), NotAuthenticated);
	});
});

describe('auth_time on issued tokens', () => {
	it('stamps the sign in time on every new login token', async () => {
		const before = now();
		const payload = await EdumeetAuthenticationService.prototype.getPayload.call(
			{},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ payload: { custom: 'kept' } } as any
		) as Record<string, unknown>;

		assert.strictEqual(payload.custom, 'kept');
		assert.strictEqual(typeof payload.auth_time, 'number');
		assert.ok((payload.auth_time as number) >= before && (payload.auth_time as number) <= now());
	});
});
