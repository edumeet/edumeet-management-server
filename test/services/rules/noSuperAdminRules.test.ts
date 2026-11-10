import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

describe('rules that grant super admin', () => {
	let tenantId: number;
	let ruleId: number;
	const superAdmin = (): Params => ({ provider: 'rest', authenticated: true, user: { id: 1, roles: [ 'super-admin' ] }, query: {} }) as unknown as Params;
	const tenantAdmin = (): Params => ({ provider: 'rest', authenticated: true, user: { id: 906, tenantId, tenantAdmin: true, roles: [] }, query: {} }) as unknown as Params;
	const ruleData = () => ({ name: `sa-${Date.now()}`, tenantId, type: 'gain', parameter: 'email', method: 'endswith', negate: false, value: '@x.example', action: 'superAdmin', accessId: '' });

	before(async () => {
		tenantId = Number((await app.service('tenants').create({ name: `sa-rules-${Date.now()}`, description: 'rules' }, internal)).id);
		// One stored before rules were refused.
		ruleId = Number((await app.service('rules').create(ruleData() as never, internal)).id);
	});

	after(async () => {
		if (ruleId) await app.service('rules').remove(ruleId, internal);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	it('cannot be created, not even by a super admin', async () => {
		await assert.rejects(app.service('rules').create(ruleData() as never, superAdmin()), /can no longer grant super admin/);
		await assert.rejects(app.service('rules').create({ ...ruleData(), action: 'superAdmin' } as never, tenantAdmin()), /can no longer grant super admin/);
	});

	it('cannot be made from an existing rule', async () => {
		await assert.rejects(app.service('rules').patch(ruleId, { action: 'superAdmin' } as never, tenantAdmin()), /can no longer grant super admin/);
	});
});
