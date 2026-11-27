import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import type { Knex } from 'knex';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// The tenant check before a removal looks a row up by its id, and the database then removes
// a row by that id. Both have to mean the same row: PostgreSQL reads '12_3' as 123 and
// MySQL reads '1e1' as 10, where parseInt reads 12 and 1.
describe('removing a permission from a role', () => {
	const knex = (): Knex => app.get('postgresqlClient');
	// Ids far above anything the sequence hands out, so that one is the leading digits of another.
	const own = 700000 + Math.floor(Math.random() * 90000);
	const foreign = (own * 10) + 3;
	const foreignByExponent = own * 10;
	let ownTenant: number;
	let otherTenant: number;
	let ownRole: number;
	let otherRole: number;
	let permissionId: number;
	let secondPermissionId: number;

	const admin = (): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: 9001, tenantId: ownTenant, tenantAdmin: true, tenantOwner: false, roles: [] as string[] },
		query: {}
	}) as unknown as Params;
	const rows = async (): Promise<number[]> => (await knex()('rolePermissions').whereIn('id', [ own, foreign, foreignByExponent ])
		.select('id'))
		.map((row) => Number(row.id)).sort((a, b) => a - b);

	before(async () => {
		ownTenant = Number((await app.service('tenants').create({ name: `rp-own-${Date.now()}`, description: '' }, internal)).id);
		otherTenant = Number((await app.service('tenants').create({ name: `rp-other-${Date.now()}`, description: '' }, internal)).id);
		ownRole = Number((await app.service('roles').create({ name: 'own', description: '', tenantId: ownTenant }, internal)).id);
		otherRole = Number((await app.service('roles').create({ name: 'other', description: '', tenantId: otherTenant }, internal)).id);
		[ permissionId, secondPermissionId ] = (await knex()('permissions').orderBy('id')
			.limit(2)
			.select('id')).map((row) => Number(row.id));
	});

	beforeEach(async () => {
		await knex()('rolePermissions').whereIn('id', [ own, foreign, foreignByExponent ])
			.del();
		await knex()('rolePermissions').insert([
			{ id: own, roleId: ownRole, permissionId },
			{ id: foreign, roleId: otherRole, permissionId },
			{ id: foreignByExponent, roleId: otherRole, permissionId: secondPermissionId }
		]);
	});

	after(async () => {
		await knex()('rolePermissions').whereIn('id', [ own, foreign, foreignByExponent ])
			.del();
		for (const id of [ ownRole, otherRole ]) await app.service('roles').remove(id, internal)
			.catch(() => undefined);
		for (const id of [ ownTenant, otherTenant ]) await app.service('tenants').remove(id, internal)
			.catch(() => undefined);
	});

	it('refuses an id that is not a plain positive integer, and removes nothing', async () => {
		const ids = [ `${own}_3`, `${own}e1`, `${own}.0`, `${own}.4`, ` ${own}`, `${own} `, `+${own}`, `-${own}`, `0x${own.toString(16)}`, `${own}abc`, '', own + 0.5 ];

		for (const id of ids) {
			await assert.rejects(
				app.service('rolePermissions').remove(id as never, admin()),
				(error: { name: string }) => error.name === 'BadRequest',
				`id ${JSON.stringify(id)}`
			);
		}

		assert.deepStrictEqual(await rows(), [ own, foreignByExponent, foreign ]);
	});

	it('does not remove a row of a role of another tenant', async () => {
		await assert.rejects(app.service('rolePermissions').remove(foreign, admin()));
		await assert.rejects(app.service('rolePermissions').remove(String(foreign) as never, admin()));

		assert.deepStrictEqual(await rows(), [ own, foreignByExponent, foreign ]);
	});

	it('removes a row of an own role, by number and by text', async () => {
		await app.service('rolePermissions').remove(String(own) as never, admin());
		assert.deepStrictEqual(await rows(), [ foreignByExponent, foreign ]);

		await knex()('rolePermissions').insert({ id: own, roleId: ownRole, permissionId });
		await app.service('rolePermissions').remove(own, admin());
		assert.deepStrictEqual(await rows(), [ foreignByExponent, foreign ]);
	});
});
