import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import type { Knex } from 'knex';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// A rule or role of a tenant admin stays in the admin's tenant. The check used to read the
// tenantId of the request with parseInt, while the database stored the value as sent: MySQL
// rounds 5.5 to 6, the next tenant.
describe('the tenant of a rule or role on patch', () => {
	const knex = (): Knex => app.get('postgresqlClient');
	let ownTenant: number;
	let nextTenant: number;
	let ruleId: number;
	let roleId: number;

	const admin = (): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: 9001, tenantId: ownTenant, tenantAdmin: true, tenantOwner: false, roles: [] as string[] },
		query: {}
	}) as unknown as Params;
	const superAdmin = (): Params => ({ provider: 'rest', authenticated: true, user: { id: 1, tenantId: null, roles: [ 'super-admin' ] }, query: {} }) as unknown as Params;
	const tenantOf = async (table: string, id: number): Promise<number> => Number((await knex()(table).where({ id })
		.first('tenantId')).tenantId);

	before(async () => {
		ownTenant = Number((await app.service('tenants').create({ name: `pt-own-${Date.now()}`, description: '' }, internal)).id);
		nextTenant = Number((await app.service('tenants').create({ name: `pt-next-${Date.now()}`, description: '' }, internal)).id);
		ruleId = Number((await app.service('rules').create({
			name: 'own', tenantId: ownTenant, type: 'gain', parameter: 'email', method: 'endswith', negate: false, value: '@x.example', action: 'tenantAdmins', accessId: ''
		} as never, internal)).id);
		roleId = Number((await app.service('roles').create({ name: 'own', description: '', tenantId: ownTenant }, internal)).id);
	});

	after(async () => {
		await knex()('rules').where({ id: ruleId })
			.del();
		await knex()('roles').where({ id: roleId })
			.del();
		for (const id of [ ownTenant, nextTenant ]) await app.service('tenants').remove(id, internal)
			.catch(() => undefined);
	});

	for (const [ service, table, id ] of [ [ 'rules', 'rules', () => ruleId ], [ 'roles', 'roles', () => roleId ] ] as const) {
		describe(service, () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const patch = (data: Record<string, unknown>, params: Params) => (app.service(service) as any).patch(id(), data, params);

			it('refuses a tenantId that is not an integer before the database sees it', async () => {
				for (const tenantId of [ ownTenant + 0.5, ownTenant + 0.9, nextTenant - 0.1 ]) {
					await assert.rejects(
						patch({ tenantId }, admin()),
						(error: { name: string, message: string }) => error.name === 'BadRequest' && /validation failed/.test(error.message),
						`tenantId ${tenantId}`
					);
				}

				assert.strictEqual(await tenantOf(table, id()), ownTenant);
			});

			it('keeps the row in the tenant of a tenant admin, whatever tenant the request names', async () => {
				await patch({ name: 'renamed', tenantId: nextTenant }, admin());
				assert.strictEqual(await tenantOf(table, id()), ownTenant);

				// and a patch that names no tenant is a patch of the own row
				await patch({ name: 'renamed again' }, admin());
				assert.strictEqual(await tenantOf(table, id()), ownTenant);
			});

			it('lets a super admin move the row', async () => {
				await patch({ tenantId: nextTenant }, superAdmin());
				assert.strictEqual(await tenantOf(table, id()), nextTenant);

				await patch({ tenantId: ownTenant }, superAdmin());
				assert.strictEqual(await tenantOf(table, id()), ownTenant);
			});
		});
	}
});
