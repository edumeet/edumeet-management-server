import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// The locks on a tenant's defaults are the super administrator's, through the real service on
// whichever database the suite runs against.
describe('defaults locks', () => {
	let tenantId: number;
	let freshTenantId: number;
	let defaultsId: number | string;
	const created: Array<number | string> = [];

	const as = (user: Record<string, unknown>): Params => ({ provider: 'rest', authenticated: true, user: user as never, query: {} });
	const tenantAdmin = (tenant: number) => as({ id: 902, tenantId: tenant, tenantAdmin: true, roles: [] as string[] });
	const superAdmin = as({ id: 903, tenantId: null, roles: [ 'super-admin' ] });
	const stored = async () => app.service('defaults').get(defaultsId, internal) as unknown as Record<string, unknown>;

	before(async () => {
		tenantId = Number((await app.service('tenants').create({ name: `locks-${Date.now()}`, description: 'x' }, internal)).id);
		freshTenantId = Number((await app.service('tenants').create({ name: `locks-fresh-${Date.now()}`, description: 'x' }, internal)).id);

		defaultsId = (await app.service('defaults').create({ tenantId }, internal)).id;
		created.push(defaultsId);
		await app.service('defaults').patch(defaultsId, {
			endToEndEncryption: true, endToEndEncryptionLock: true, reactionsEnabledUnmanaged: true, reactionsEnabledLock: true,
		}, internal);
	});

	after(async () => {
		for (const id of created) await app.service('defaults').remove(id, internal);
		await app.service('tenants').remove(tenantId, internal);
		await app.service('tenants').remove(freshTenantId, internal);
	});

	it('keeps a locked setting and its lock when the tenant admin tries to withdraw both, and applies the rest', async () => {
		await app.service('defaults').patch(defaultsId, {
			endToEndEncryptionLock: false,
			endToEndEncryption: false,
			reactionsEnabledLock: false,
			reactionsEnabledUnmanaged: false,
			chatEnabledUnmanaged: false,
		}, tenantAdmin(tenantId));

		const row = await stored();

		assert.strictEqual(Boolean(row.endToEndEncryptionLock), true);
		assert.strictEqual(Boolean(row.endToEndEncryption), true);
		assert.strictEqual(Boolean(row.reactionsEnabledLock), true);
		assert.strictEqual(Boolean(row.reactionsEnabledUnmanaged), true);
		assert.strictEqual(Boolean(row.chatEnabledUnmanaged), false);
	});

	it('lets the super administrator lift a lock, after which the tenant admin may change the setting', async () => {
		await app.service('defaults').patch(defaultsId, { endToEndEncryptionLock: false }, superAdmin);
		await app.service('defaults').patch(defaultsId, { endToEndEncryption: false }, tenantAdmin(tenantId));

		const row = await stored();

		assert.strictEqual(Boolean(row.endToEndEncryptionLock), false);
		assert.strictEqual(Boolean(row.endToEndEncryption), false);
	});

	it('gives a tenant admin\'s new defaults row no lock it asked for', async () => {
		const row = await app.service('defaults').create({ tenantId: freshTenantId, endToEndEncryptionLock: true } as never, tenantAdmin(freshTenantId));

		created.push(row.id);

		const read = await app.service('defaults').get(row.id, internal) as unknown as Record<string, unknown>;

		assert.strictEqual(Boolean(read.endToEndEncryptionLock), false);
	});
});
