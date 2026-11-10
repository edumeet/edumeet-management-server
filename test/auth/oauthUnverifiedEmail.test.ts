/* eslint-disable camelcase */
// An e-mail address the identity provider did not verify must not admit anyone or earn
// a grant. Runs the registered "tenant" strategy against the database.
import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../src/app';
import type OAuthTenantStrategy from '../../src/auth/strategies/OAuthTenantStrategy';
import { refreshAccessCheck } from '../../src/hooks/refreshAccessCheck';
import type { HookContext } from '../../src/declarations';

// MySQL stores the flag as 0 or 1.
const flag = (value: unknown): boolean | null => (value === null || value === undefined ? null : Boolean(Number(value)));

const internal = { provider: undefined, query: {} };

describe('OAuth tenant login with an unverified e-mail', () => {
	let tenantId: number;
	let oauthId: number;
	const ruleIds: number[] = [];
	const stamp = Date.now();

	const strategy = () => app.service('authentication').getStrategy('tenant') as unknown as OAuthTenantStrategy;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const callbackParams = (): any => ({
		query: { tenantId: String(tenantId) },
		session: { grant: { provider: String(tenantId) } },
		authStrategies: [ 'tenant' ]
	});
	const signIn = (sub: string, email: string, email_verified?: unknown) =>
		strategy().authenticate({ strategy: 'tenant', profile: { sub, email, email_verified } }, callbackParams());
	const rule = async (data: Record<string, unknown>) => {
		const row = await app.service('rules').create({
			name: `r-${stamp}-${ruleIds.length}`, tenantId, negate: false, action: '', accessId: '', ...data
		} as never, internal);

		ruleIds.push(Number(row.id));
	};
	const usersOf = async () =>
		app.service('users').find({ ...internal, query: { tenantId }, paginate: false } as unknown as Params) as unknown as Promise<Array<{ id: number, email: string, ssoId: string }>>;
	const isAdmin = async (userId: number) =>
		(await app.service('tenantAdmins').find({ ...internal, query: { tenantId, userId }, paginate: false } as unknown as Params) as unknown as unknown[]).length > 0;
	const setTrust = (trust_email: boolean) => app.service('tenantOAuths').patch(oauthId, { trust_email }, internal);

	before(async () => {
		tenantId = Number((await app.service('tenants').create({ name: `unverified-${stamp}`, description: 'unverified e-mail' }, internal)).id);
		oauthId = Number((await app.service('tenantOAuths').create({
			tenantId,
			key: 'k',
			secret: 's',
			authorize_url: 'https://idp.example/auth',
			access_url: 'https://idp.example/token',
			profile_url: 'https://idp.example/userinfo'
		}, internal)).id);

		// Only the university's addresses get in; its staff prefix becomes tenant admin.
		await rule({ type: 'block', method: 'anyone', parameter: '', value: '' });
		await rule({ type: 'allow', method: 'endswith', parameter: 'email', value: '@uni.example' });
		await rule({ type: 'block', method: 'equals', parameter: 'email', value: 'banned@uni.example' });
		await rule({ type: 'gain', method: 'startswith', parameter: 'email', value: 'admin', action: 'tenantAdmins' });
	});

	afterEach(async () => {
		await setTrust(false);
		for (const user of await usersOf()) {
			for (const service of [ 'tenantAdmins', 'tenantOwners' ] as const) {
				const rows = await app.service(service).find({ ...internal, query: { tenantId, userId: user.id }, paginate: false } as unknown as Params) as unknown as Array<{ id: number }>;

				for (const row of rows) await app.service(service).remove(row.id, internal);
			}
			await app.service('users').remove(user.id, internal);
		}
	});

	after(async () => {
		for (const id of ruleIds) await app.service('rules').remove(id, internal);
		if (oauthId) await app.service('tenantOAuths').remove(oauthId, internal);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	it('does not pass an allow rule on an unverified address', async () => {
		for (const email_verified of [ undefined, false, 'false' ])
			await assert.rejects(signIn(`s-${email_verified}`, 'someone@uni.example', email_verified), /not allowed by rule/);
		assert.deepStrictEqual(await usersOf(), []);
	});

	it('admits a verified address and grants what its rules give', async () => {
		const result = await signIn('admin-sub', 'admin@uni.example', true);

		assert.strictEqual(await isAdmin(Number(result.user.id)), true);
	});

	it('still applies a block rule to an unverified address, in any letter case', async () => {
		await setTrust(true);
		await assert.rejects(signIn('banned-sub', 'BANNED@uni.example', true), /not allowed by rule/);
		await setTrust(false);
		await assert.rejects(signIn('banned-sub', 'banned@uni.example'), /not allowed by rule/);
	});

	it('is refused by a negated block rule that describes the allowed domain', async () => {
		// "Block whose e-mail does not end with @uni.example": an allow list written as a block.
		const rules = await app.service('rules').find({ ...internal, query: { tenantId }, paginate: false } as unknown as Params) as unknown as Array<{ id: number, type: string, method: string }>;
		const blockAnyone = rules.find((r) => r.type === 'block' && r.method === 'anyone');

		await app.service('rules').patch(Number(blockAnyone?.id), { type: 'block', method: 'endswith', parameter: 'email', value: '@uni.example', negate: true }, internal);
		try {
			await assert.rejects(signIn('negated-sub', 'someone@uni.example'), /not allowed by rule/);
			await assert.rejects(signIn('negated-sub', 'Someone@UNI.example', 'false'), /not allowed by rule/);

			const verified = await signIn('negated-ok', 'someone@uni.example', true);

			assert.ok(verified.user.id);
		} finally {
			await app.service('rules').patch(Number(blockAnyone?.id), { type: 'block', method: 'anyone', parameter: '', value: '', negate: false }, internal);
		}
	});

	it('trusts the provider\'s addresses when the tenant says so (trust_email)', async () => {
		await setTrust(true);

		const result = await signIn('feide-sub', 'admin@uni.example', false);

		assert.strictEqual(await isAdmin(Number(result.user.id)), true);
	});

	it('neither grants nor replaces the stored address for a returning user\'s unverified claim', async () => {
		const first = await signIn('returning-sub', 'user@uni.example', true);
		const userId = Number(first.user.id);

		await signIn('returning-sub', 'admin@uni.example', false).catch(() => undefined);

		const [ stored ] = (await usersOf()).filter((u) => Number(u.id) === userId);

		assert.strictEqual(stored.email, 'user@uni.example');
		assert.strictEqual(await isAdmin(userId), false);
	});

	it('gives no grant for an unverified address in a tenant without access rules on it', async () => {
		// Remove the allow-list so the unverified user gets in, and check the grant only.
		const rules = await app.service('rules').find({ ...internal, query: { tenantId }, paginate: false } as unknown as Params) as unknown as Array<{ id: number, type: string, method: string }>;
		const blockAnyone = rules.find((r) => r.type === 'block' && r.method === 'anyone');

		await app.service('rules').patch(Number(blockAnyone?.id), { type: 'allow' }, internal);
		try {
			const result = await signIn('claimer-sub', 'admin-claimed@elsewhere.example');

			assert.strictEqual(await isAdmin(Number(result.user.id)), false);
		} finally {
			await app.service('rules').patch(Number(blockAnyone?.id), { type: 'block' }, internal);
		}
	});
	describe('an account created from an unverified address', () => {
		// Lets the unverified user in, by turning the catch-all block into an allow.
		const openTenant = async () => {
			const rules = await app.service('rules').find({ ...internal, query: { tenantId }, paginate: false } as unknown as Params) as unknown as Array<{ id: number, type: string, method: string }>;
			const catchAll = rules.find((r) => r.method === 'anyone');

			await app.service('rules').patch(Number(catchAll?.id), { type: 'allow' }, internal);

			return () => app.service('rules').patch(Number(catchAll?.id), { type: 'block' }, internal);
		};
		const refresh = (user: unknown) => refreshAccessCheck({
			app,
			params: { user, authentication: { payload: { auth_time: Math.floor(Date.now() / 1000) } } }
		} as unknown as HookContext);

		it('remembers that its address is unverified', async () => {
			const close = await openTenant();

			try {
				const result = await signIn('claim-sub', 'claimed@uni.example');
				const stored = await app.service('users').get(Number(result.user.id), internal);

				assert.strictEqual(flag(stored.emailVerified), false);

				const verified = await signIn('verified-sub', 'verified@uni.example', true);

				assert.strictEqual(flag((await app.service('users').get(Number(verified.user.id), internal)).emailVerified), true);
			} finally {
				await close();
			}
		});

		it('is not let in by an allow rule at token refresh', async () => {
			const close = await openTenant();
			let user;

			try {
				user = (await signIn('refresh-sub', 'someone@uni.example')).user;
			} finally {
				await close();
			}

			// The tenant is an allow list again: the stored, unverified address must not pass it.
			await assert.rejects(refresh(await app.service('users').get(Number(user.id), internal)), /not allowed by rule/);
		});

		it('is treated as unverified also when stored as 0, as MySQL returns it', async () => {
			const close = await openTenant();
			let user;

			try {
				user = (await signIn('mysql-sub', 'mysql@uni.example', true)).user;
			} finally {
				await close();
			}

			const stored = await app.service('users').get(Number(user.id), internal);

			await assert.rejects(refresh({ ...stored, email: 'someone@uni.example', emailVerified: 0 }), /not allowed by rule/);
		});

		it('settles an account from before the flag at its next sign in', async () => {
			const close = await openTenant();

			try {
				// eslint-disable-next-line no-unused-vars
				const createUser = app.service('users').create as unknown as (data: Record<string, unknown>, params: unknown) => Promise<{ id: number }>;
				const legacy = await createUser.call(app.service('users'), { email: 'legacy@uni.example', name: 'Legacy', tenantId, ssoId: 'legacy-sub' }, internal);

				assert.strictEqual(flag((await app.service('users').get(Number(legacy.id), internal)).emailVerified), null);
				await signIn('legacy-sub', 'legacy@uni.example');
				assert.strictEqual(flag((await app.service('users').get(Number(legacy.id), internal)).emailVerified), false);
			} finally {
				await close();
			}
		});

		it('cannot be taken over by someone signing in with that address, verified', async () => {
			const close = await openTenant();

			try {
				await signIn('squatter-sub', 'victim@uni.example');
				await assert.rejects(signIn('victim-sub', 'victim@uni.example', true), /never confirmed/);
			} finally {
				await close();
			}
		});
	});
});
