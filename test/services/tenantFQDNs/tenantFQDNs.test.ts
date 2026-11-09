// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';
import { resolveAllowedOrigin } from '../../../src/auth/allowedOrigin';

const internal = { provider: undefined, query: {} };

describe('tenantFQDNs service', () => {
	it('registered the service', () => {
		const service = app.service('tenantFQDNs');

		assert.ok(service, 'Registered the service');
	});

	describe('as a tenant admin over the API', () => {
		let tenantId: number;
		let fqdnId: number;

		const admin = (over: Record<string, unknown> = {}): Params => ({
			provider: 'rest',
			authenticated: true,
			user: { id: 901, tenantId, tenantAdmin: true, roles: [] as string[], ...over },
			query: {},
		}) as unknown as Params;

		before(async () => {
			const tenant = await app.service('tenants').create({ name: `fqdn-${Date.now()}`, description: 'fqdn hook test' }, internal);

			tenantId = Number(tenant.id);
		});

		after(async () => {
			if (tenantId) await app.service('tenants').remove(tenantId, internal);
		});

		it('creates an FQDN in the own tenant, whatever tenantId the form sent', async () => {
			const created = await app.service('tenantFQDNs').create({ tenantId: 999999, fqdn: `rooms-${Date.now()}.example.edu`, description: 'made by admin' }, admin());

			fqdnId = Number(created.id);
			assert.strictEqual(Number(created.tenantId), tenantId);
		});

		it('refuses a user who is not a tenant admin', async () => {
			await assert.rejects(
				app.service('tenantFQDNs').create({ tenantId, fqdn: 'nope.example.edu' }, admin({ tenantAdmin: false })),
				/Not a tenant admin/
			);
		});

		it('refuses an admin of another tenant on patch and remove', async () => {
			await assert.rejects(app.service('tenantFQDNs').patch(fqdnId, { description: 'x' }, admin({ tenantId: tenantId + 1 })), /same tenant/);
			await assert.rejects(app.service('tenantFQDNs').remove(fqdnId, admin({ tenantId: tenantId + 1 })), /same tenant/);
		});

		it('keeps the row in the own tenant when a patch sends another tenantId', async () => {
			const other = await app.service('tenants').create({ name: `fqdn-other-${Date.now()}`, description: 'target tenant' }, internal);
			const fqdn = `moved-${Date.now()}.example.edu`;
			const row = await app.service('tenantFQDNs').create({ tenantId, fqdn, description: 'to move' }, admin());

			try {
				const patched = await app.service('tenantFQDNs').patch(row.id, { tenantId: Number(other.id) }, admin());

				assert.strictEqual(Number(patched.tenantId), tenantId);
				assert.strictEqual(Number((await app.service('tenantFQDNs').get(row.id, internal)).tenantId), tenantId);
				await assert.rejects(resolveAllowedOrigin(app, Number(other.id), `https://${fqdn}`));
			} finally {
				await app.service('tenantFQDNs').remove(row.id, internal);
				await app.service('tenants').remove(other.id, internal);
			}
		});

		it('lets the own admin patch and remove', async () => {
			const patched = await app.service('tenantFQDNs').patch(fqdnId, { description: 'renamed' }, admin());

			assert.strictEqual(patched.description, 'renamed');
			await app.service('tenantFQDNs').remove(fqdnId, admin());
		});
	});
});
