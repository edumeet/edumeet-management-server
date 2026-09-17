import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';
import { hashBotToken } from '../../../src/bots/verify';
import { tenantBotCredentialExternalResolver } from '../../../src/services/tenantBotCredentials/tenantBotCredentials.schema';
import type { HookContext } from '../../../src/declarations';

const internal = { provider: undefined, query: {} };

describe('tenantBotCredentials service', () => {
	let tenantId: number;

	before(async () => {
		const tenant = await app.service('tenants').create({ name: `bots-${Date.now()}`, description: 'bot credentials test' }, internal);

		tenantId = Number(tenant.id);
	});

	after(async () => {
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	it('registered the service', () => {
		assert.ok(app.service('tenantBotCredentials'), 'Registered the service');
		assert.ok(app.service('bot-verify'), 'Registered the verify service');
	});

	it('stores the ranges on both dialects and hands them back as an array', async () => {
		const created = await app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Recorder',
			tokenHash: hashBotToken('token-one'),
			allowedIps: [ '10.0.0.0/8', '2001:db8::/32' ],
		}, internal);

		assert.deepStrictEqual(created.allowedIps, [ '10.0.0.0/8', '2001:db8::/32' ]);
		assert.strictEqual(created.enabled, true);
		assert.ok(created.createdAt && created.createdAt > 0);

		const fetched = await app.service('tenantBotCredentials').get(created.id, internal);

		assert.deepStrictEqual(fetched.allowedIps, [ '10.0.0.0/8', '2001:db8::/32' ]);

		const listed = await app.service('tenantBotCredentials').find({ ...internal, query: { tenantId }, paginate: false });

		assert.strictEqual((listed as unknown[]).length, 1);
	});

	it('refuses a range that is not an address', async () => {
		await assert.rejects(
			app.service('tenantBotCredentials').create({ tenantId, label: 'Bad', tokenHash: hashBotToken('token-two'), allowedIps: [ 'recorder.example.edu' ] }, internal),
			/Not an IP address or range/
		);
	});

	it('refuses an unhashed token and an empty range list', async () => {
		await assert.rejects(app.service('tenantBotCredentials').create({ tenantId, label: 'Plain', tokenHash: 'token-three', allowedIps: [ '10.0.0.1' ] }, internal));
		await assert.rejects(app.service('tenantBotCredentials').create({ tenantId, label: 'Empty', tokenHash: hashBotToken('token-four'), allowedIps: [] }, internal));
	});

	it('verifies through the tenant policy and stamps the last use', async () => {
		const verify = app.service('bot-verify');
		const [ credential ] = await app.service('tenantBotCredentials').find({ ...internal, query: { tenantId }, paginate: false }) as { id: number, lastUsedAt?: number | null }[];

		assert.deepStrictEqual(await verify.create({ tenantId, botToken: 'token-one', address: '10.1.1.1' }, internal), { allowed: false, reason: 'botsNotAllowed' });

		await app.service('tenants').patch(tenantId, { botPolicy: 'tokenOnly' }, internal);

		assert.deepStrictEqual(await verify.create({ tenantId, address: '10.1.1.1' }, internal), { allowed: false, reason: 'botsNotAllowed' });
		assert.deepStrictEqual(await verify.create({ tenantId, botToken: 'wrong', address: '10.1.1.1' }, internal), { allowed: false, reason: 'botTokenRejected' });
		assert.deepStrictEqual(await verify.create({ tenantId, botToken: 'token-one', address: '192.0.2.9' }, internal), { allowed: false, reason: 'botTokenRejected' });
		assert.deepStrictEqual(
			await verify.create({ tenantId, botToken: 'token-one', address: '10.1.1.1' }, internal),
			{ allowed: true, verified: true, label: 'Recorder', credentialId: Number(credential.id) }
		);

		const used = await app.service('tenantBotCredentials').get(credential.id, internal);

		assert.ok(used.lastUsedAt && used.lastUsedAt > 0);

		await app.service('tenants').patch(tenantId, { botPolicy: 'all' }, internal);

		assert.deepStrictEqual(await verify.create({ tenantId, address: '10.1.1.1' }, internal), { allowed: true, verified: false });

		await app.service('tenantBotCredentials').patch(credential.id, { enabled: false }, internal);

		assert.deepStrictEqual(await verify.create({ tenantId, botToken: 'token-one', address: '10.1.1.1' }, internal), { allowed: false, reason: 'botTokenRejected' });
	});

	describe('as a tenant admin over the API', () => {
		const admin = (over: Record<string, unknown> = {}): Params => ({
			provider: 'rest',
			authenticated: true,
			user: { id: 900, tenantId, tenantAdmin: true, roles: [] as string[], ...over },
			query: {},
		}) as unknown as Params;
		let createdId: number;

		it("creates a credential in the admin's own tenant, whatever tenantId the form sent", async () => {
			const created = await app.service('tenantBotCredentials').create({
				tenantId: 999999, label: 'Admin made', tokenHash: hashBotToken('token-admin'), allowedIps: [ '198.51.100.0/24' ],
			}, admin());

			createdId = Number(created.id);
			assert.strictEqual(Number(created.tenantId), tenantId);
			assert.deepStrictEqual(created.allowedIps, [ '198.51.100.0/24' ]);
		});

		it('lists only the own tenant', async () => {
			const listed = await app.service('tenantBotCredentials').find({ ...admin(), query: { tenantId: 999999 }, paginate: false }) as { tenantId: number }[];

			assert.ok(listed.length >= 2);
			assert.ok(listed.every((row) => Number(row.tenantId) === tenantId));
		});

		// resolveExternal shapes context.dispatch, what the transport sends; the
		// in-process return value keeps the hash, so the resolver is checked directly.
		it('strips the hash from what goes to the API client', async () => {
			const row = { id: 1, tenantId, label: 'x', tokenHash: hashBotToken('t'), allowedIps: [ '10.0.0.1' ], enabled: true };
			const sent = await tenantBotCredentialExternalResolver.resolve(row, { params: admin(), app } as unknown as HookContext);

			assert.strictEqual((sent as { tokenHash?: string }).tokenHash, undefined);
			assert.strictEqual(sent.label, 'x');
		});

		it('refuses a user who is not a tenant admin', async () => {
			await assert.rejects(
				app.service('tenantBotCredentials').create({ tenantId, label: 'Nope', tokenHash: hashBotToken('token-user'), allowedIps: [ '10.0.0.1' ] }, admin({ tenantAdmin: false })),
				/Not a tenant admin/
			);
		});

		it('refuses an admin of another tenant on patch and remove', async () => {
			await assert.rejects(app.service('tenantBotCredentials').patch(createdId, { enabled: false }, admin({ tenantId: tenantId + 1 })), /same tenant/);
			await assert.rejects(app.service('tenantBotCredentials').remove(createdId, admin({ tenantId: tenantId + 1 })), /same tenant/);
		});

		it('lets the own admin patch and remove', async () => {
			const patched = await app.service('tenantBotCredentials').patch(createdId, { enabled: false, allowedIps: [ '198.51.100.7' ] }, admin());

			assert.strictEqual(patched.enabled, false);
			assert.deepStrictEqual(patched.allowedIps, [ '198.51.100.7' ]);
			await app.service('tenantBotCredentials').remove(createdId, admin());
		});
	});

	it('does not accept a new hash on patch', async () => {
		const [ credential ] = await app.service('tenantBotCredentials').find({ ...internal, query: { tenantId }, paginate: false }) as { id: number }[];

		await assert.rejects(app.service('tenantBotCredentials').patch(credential.id, { tokenHash: hashBotToken('other') } as never, internal));
	});
});
