/* eslint-disable camelcase */
// Runs the registered "tenant" OAuth strategy against the database, the way the
// OAuth callback does, to check how a profile is matched to an existing account.
import assert from 'assert';
import { app } from '../../src/app';
import type OAuthTenantStrategy from '../../src/auth/strategies/OAuthTenantStrategy';

const internal = { provider: undefined, query: {} };

describe('OAuth tenant login against existing accounts', () => {
	let tenantId: number;
	let userId: number;
	const email = `owner-${Date.now()}@acme.edu`;

	const strategy = () => app.service('authentication').getStrategy('tenant') as unknown as OAuthTenantStrategy;
	// What OAuthService.authenticate passes on: the stored session and its query.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const callbackParams = (): any => ({
		query: { tenantId: String(tenantId) },
		session: { grant: { provider: String(tenantId) } },
		authStrategies: [ 'tenant' ]
	});
	const storedSsoId = async () => (await app.service('users').get(userId, internal)).ssoId;

	before(async () => {
		const tenant = await app.service('tenants').create({ name: `link-${Date.now()}`, description: 'oauth linking test' }, internal);

		tenantId = Number(tenant.id);

		// An SSO account as the strategy creates it: no password.
		const createUser = app.service('users').create as unknown as (data: Record<string, unknown>, params: unknown) => Promise<{ id: number }>;
		const user = await createUser.call(app.service('users'), { email, name: 'Owner', tenantId, ssoId: 'original-sub' }, internal);

		userId = Number(user.id);
	});

	after(async () => {
		if (userId) await app.service('users').remove(userId, internal);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	for (const email_verified of [ undefined, false, 'false' ]) {
		it(`refuses a new subject with the owner's e-mail when email_verified is ${email_verified}`, async () => {
			await assert.rejects(
				strategy().authenticate({ strategy: 'tenant', profile: { sub: 'attacker-sub', email, email_verified } }, callbackParams()),
				/already exists/
			);
			assert.strictEqual(await storedSsoId(), 'original-sub');
		});
	}

	it('signs the existing subject in as before', async () => {
		const result = await strategy().authenticate({ strategy: 'tenant', profile: { sub: 'original-sub', email } }, callbackParams());

		assert.strictEqual(Number(result.user.id), userId);
	});

	it('links a new subject when the identity provider verified the e-mail', async () => {
		const result = await strategy().authenticate(
			{ strategy: 'tenant', profile: { sub: 'migrated-sub', email, email_verified: true } },
			callbackParams()
		);

		assert.strictEqual(Number(result.user.id), userId);
		assert.strictEqual(await storedSsoId(), 'migrated-sub');
	});
});
