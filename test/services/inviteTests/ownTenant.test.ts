import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

// The test logs in to the mail servers of a tenant with its stored passwords and reports
// their answers, so a tenant admin may only run it for their own tenant.
describe('invitation settings test', () => {
	const tenantAdmin = (tenantId: number): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: 9001, tenantId, tenantAdmin: true, tenantOwner: false, roles: [] as string[] },
	}) as unknown as Params;

	it('refuses another tenant before anything is loaded or connected', async () => {
		await assert.rejects(
			app.service('invite-tests').create({ tenantId: 424242 }, tenantAdmin(1)),
			/your own tenant/
		);
	});
});
