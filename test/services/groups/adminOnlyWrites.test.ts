import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// Groups, group memberships and role permissions decide who gets which room
// rights, so only a tenant admin may change them.
describe('group and role permission writes', () => {
	let tenantA: number;
	let tenantB: number;
	let member: number;
	let other: number;
	let userB: number;
	let groupA: number;
	let groupB: number;
	let roleA: number;
	let permissionId: number;

	const caller = (id: number, tenantId: number, tenantAdmin = false): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id, tenantId, tenantAdmin, tenantOwner: false, roles: [] as string[] },
		query: {},
	}) as unknown as Params;
	const asMember = () => caller(member, tenantA);
	const asAdmin = () => caller(904, tenantA, true);

	const membershipsOf = async (groupId: number) =>
		app.service('groupUsers').find({ ...internal, query: { groupId }, paginate: false } as unknown as Params) as unknown as Promise<Array<{ id: number, userId: number }>>;

	before(async () => {
		const stamp = `admin-writes-${Date.now()}`;
		const user = async (name: string, tenantId: number) =>
			Number((await app.service('users').create({ email: `${stamp}-${name}@example.edu`, password: 'Pw-for-tests-1', tenantId }, internal)).id);

		tenantA = Number((await app.service('tenants').create({ name: `${stamp}-a`, description: 'tenant A' }, internal)).id);
		tenantB = Number((await app.service('tenants').create({ name: `${stamp}-b`, description: 'tenant B' }, internal)).id);
		member = await user('member', tenantA);
		other = await user('other', tenantA);
		userB = await user('b', tenantB);
		groupA = Number((await app.service('groups').create({ name: `${stamp}-ga`, tenantId: tenantA }, internal)).id);
		groupB = Number((await app.service('groups').create({ name: `${stamp}-gb`, tenantId: tenantB }, internal)).id);
		roleA = Number((await app.service('roles').create({ name: `${stamp}-ra`, description: 'role A', tenantId: tenantA }, internal)).id);
		permissionId = Number((await app.service('permissions').create({ name: `${stamp}-perm`, description: 'test permission' }, internal)).id);
	});

	after(async () => {
		for (const groupId of [ groupA, groupB ]) {
			for (const row of await membershipsOf(groupId)) await app.service('groupUsers').remove(row.id, internal);
		}
		const grants = await app.service('rolePermissions').find({ ...internal, query: { roleId: roleA }, paginate: false } as unknown as Params) as unknown as Array<{ id: number }>;

		for (const row of grants) await app.service('rolePermissions').remove(row.id, internal);
		if (roleA) await app.service('roles').remove(roleA, internal);
		if (permissionId) await app.service('permissions').remove(permissionId, internal);
		for (const id of [ groupA, groupB ]) if (id) await app.service('groups').remove(id, internal)
			.catch(() => undefined);
		for (const id of [ member, other, userB ]) if (id) await app.service('users').remove(id, internal);
		for (const id of [ tenantA, tenantB ]) if (id) await app.service('tenants').remove(id, internal);
	});

	describe('groups', () => {
		it('refuses create, patch and remove by an ordinary user', async () => {
			await assert.rejects(app.service('groups').create({ name: 'by member', tenantId: tenantA }, asMember()), /tenant admin/);
			await assert.rejects(app.service('groups').patch(groupA, { name: 'renamed', tenantId: tenantA }, asMember()), /tenant admin/);
			await assert.rejects(app.service('groups').remove(groupA, asMember()), /tenant admin/);
			assert.ok(await app.service('groups').get(groupA, internal));
		});

		it('lets a tenant admin create, rename and remove', async () => {
			const created = await app.service('groups').create({ name: `admin-group-${Date.now()}`, tenantId: tenantB }, asAdmin());

			assert.strictEqual(Number(created.tenantId), tenantA);
			await app.service('groups').patch(created.id, { name: 'renamed', tenantId: tenantA }, asAdmin());
			await app.service('groups').remove(created.id, asAdmin());
		});
	});

	describe('groupUsers', () => {
		afterEach(async () => {
			for (const groupId of [ groupA, groupB ]) {
				for (const row of await membershipsOf(groupId)) await app.service('groupUsers').remove(row.id, internal);
			}
		});

		it('refuses an ordinary user adding themselves to a group', async () => {
			await assert.rejects(app.service('groupUsers').create({ groupId: groupA, userId: member }, asMember()), /tenant admin/);
			assert.strictEqual((await membershipsOf(groupA)).length, 0);
		});

		it('refuses a tenant admin adding to another tenant\'s group', async () => {
			await assert.rejects(app.service('groupUsers').create({ groupId: groupB, userId: userB }, asAdmin()), /belong to your tenant/);
			await assert.rejects(app.service('groupUsers').create({ groupId: groupB, userId: member }, asAdmin()), /same tenant/);
			assert.strictEqual((await membershipsOf(groupB)).length, 0);
		});

		it('lets a tenant admin add a user of the own tenant', async () => {
			await app.service('groupUsers').create({ groupId: groupA, userId: member }, asAdmin());
			assert.strictEqual((await membershipsOf(groupA)).length, 1);
		});

		it('lets a member leave, but not remove another member', async () => {
			const own = await app.service('groupUsers').create({ groupId: groupA, userId: member }, internal);
			const others = await app.service('groupUsers').create({ groupId: groupA, userId: other }, internal);

			await assert.rejects(app.service('groupUsers').remove(others.id, asMember()), /own membership/);
			await app.service('groupUsers').remove(own.id, asMember());
			assert.deepStrictEqual((await membershipsOf(groupA)).map((row) => Number(row.userId)), [ other ]);
		});
	});

	describe('rolePermissions', () => {
		it('refuses an ordinary user granting or revoking a permission', async () => {
			await assert.rejects(app.service('rolePermissions').create({ roleId: roleA, permissionId }, asMember()), /tenant admin/);

			const grant = await app.service('rolePermissions').create({ roleId: roleA, permissionId }, internal);

			await assert.rejects(app.service('rolePermissions').remove(grant.id, asMember()), /tenant admin/);
			await app.service('rolePermissions').remove(grant.id, internal);
		});

		it('lets a tenant admin grant and revoke', async () => {
			const grant = await app.service('rolePermissions').create({ roleId: roleA, permissionId }, asAdmin());

			await app.service('rolePermissions').remove(grant.id, asAdmin());
		});
	});
});
