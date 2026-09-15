import assert from 'assert';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import { app } from '../../../src/app';
import { logger } from '../../../src/logger';

/**
 * token-refresh against the real users, rules and tenant services and a real database, so the
 * user the rules see is the one the users service hooks actually hand to the refresh.
 */
describe('token-refresh with the real services', () => {
	const suffix = `${Date.now()}`;
	let tenantId: number;
	let ssoUserId: string;
	let localUserId: string;
	const ruleIds: number[] = [];

	const refresh = async (accessToken: string): Promise<string> => {
		const { accessToken: next } = await app.service('token-refresh').create({}, {
			provider: 'rest',
			authentication: { strategy: 'jwt', accessToken }
		});

		return next;
	};

	const tokenFor = (userId: string, authTime?: number) => app.service('authentication').createAccessToken(
		// eslint-disable-next-line camelcase
		authTime === undefined ? { sub: userId } : { sub: userId, auth_time: authTime },
		app.get('authentication')?.jwtOptions ?? {}
	);

	const now = () => Math.floor(Date.now() / 1000);

	before(async () => {
		logger.transports.forEach((t) => (t.silent = true));

		const tenant = await app.service('tenants').create({ name: `refresh-${suffix}`, description: 'token refresh test' });

		tenantId = parseInt(String(tenant.id));

		// The typed data is the self sign up shape; internal creates are validated as admin data, like SSO sign in.
		// eslint-disable-next-line no-unused-vars
		const createUser = app.service('users').create as unknown as (data: Record<string, unknown>) => Promise<{ id: number }>;
		const ssoUser = await createUser.call(app.service('users'), {
			email: `sso-${suffix}@acme.edu`,
			ssoId: `sub-${suffix}`,
			name: 'Sso User',
			tenantId
		});
		const localUser = await createUser.call(app.service('users'), {
			email: `local-${suffix}@acme.edu`,
			password: 'supersecret',
			name: 'Local User',
			tenantId
		});

		ssoUserId = String(ssoUser.id);
		localUserId = String(localUser.id);
	});

	after(async () => {
		for (const id of ruleIds) await app.service('rules').remove(id);
		await app.service('tenants').remove(tenantId);
		logger.transports.forEach((t) => (t.silent = false));
	});

	it('refreshes an SSO user the rules admit and keeps auth_time', async () => {
		const authTime = now() - 60;
		const next = await refresh(await tokenFor(ssoUserId, authTime));
		const payload = await app.service('authentication').verifyAccessToken(next);

		assert.strictEqual(payload.auth_time, authTime);
		assert.strictEqual(String(payload.sub), ssoUserId);
	});

	it('stamps auth_time on a password sign in through the real authentication service', async () => {
		const before = now();
		const { accessToken } = await app.service('authentication').create({
			strategy: 'local',
			email: `local-${suffix}@acme.edu`,
			password: 'supersecret'
		});
		const payload = await app.service('authentication').verifyAccessToken(accessToken);

		assert.ok(payload.auth_time >= before && payload.auth_time <= now());
	});

	it('refuses a token without auth_time', async () => {
		await assert.rejects(refresh(await tokenFor(ssoUserId)), NotAuthenticated);
	});

	it('refuses an SSO user once a rule on the stored email blocks them', async () => {
		const token = await tokenFor(ssoUserId, now() - 60);
		const rule = await app.service('rules').create({
			name: `block sso ${suffix}`,
			tenantId,
			type: 'block',
			parameter: 'email',
			method: 'equals',
			value: `sso-${suffix}@acme.edu`,
			negate: false,
			action: '',
			accessId: ''
		});

		ruleIds.push(parseInt(String(rule.id)));

		await assert.rejects(refresh(token), Forbidden);
	});

	it('refuses an SSO user once a rule on the stored ssoId blocks them', async () => {
		const token = await tokenFor(ssoUserId, now() - 60);

		await app.service('rules').remove(ruleIds.pop() as number);

		const rule = await app.service('rules').create({
			name: `block sub ${suffix}`,
			tenantId,
			type: 'block',
			parameter: 'ssoId',
			method: 'equals',
			value: `sub-${suffix}`,
			negate: false,
			action: '',
			accessId: ''
		});

		ruleIds.push(parseInt(String(rule.id)));

		await assert.rejects(refresh(token), Forbidden);
	});

	it('refreshes a local account in the same tenant despite a Block anyone rule', async () => {
		const rule = await app.service('rules').create({
			name: `block anyone ${suffix}`,
			tenantId,
			type: 'block',
			parameter: '',
			method: 'anyone',
			value: '',
			negate: false,
			action: '',
			accessId: ''
		});

		ruleIds.push(parseInt(String(rule.id)));

		assert.ok(await refresh(await tokenFor(localUserId, now() - 60)));
		await assert.rejects(refresh(await tokenFor(ssoUserId, now() - 60)), Forbidden);
	});

	it('refuses any user past the maximum session age', async () => {
		const old = now() - (31 * 24 * 60 * 60);

		await assert.rejects(refresh(await tokenFor(localUserId, old)), NotAuthenticated);
	});
});
