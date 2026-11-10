import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// Room owners and tenant admins hand out rights in rooms. They must stay in the rooms they
// own, and what they hand out (users, roles, groups) must be of their own tenant.
describe('room rights across rooms and tenants', () => {
	const stamp = `rights-${Date.now()}`;
	let tenantA: number;
	let tenantB: number;
	let owner: number;
	let userA: number;
	let userB: number;
	let ownRoom: number;
	let otherRoom: number;
	let roleA: number;
	let roleB: number;
	let groupA: number;
	let groupB: number;
	let otherGroupRole: number;
	let otherOwnerRow: number;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svc = (path: string) => app.service(path as any) as any;
	const asOwner = (): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: owner, tenantId: tenantA, tenantAdmin: false, tenantOwner: false, roles: [] as string[] },
		query: {},
	}) as unknown as Params;
	const asAdmin = (): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: 905, tenantId: tenantA, tenantAdmin: true, tenantOwner: false, roles: [] as string[] },
		query: {},
	}) as unknown as Params;

	before(async () => {
		const user = async (name: string, tenantId: number) =>
			Number((await svc('users').create({ email: `${stamp}-${name}@example.edu`, password: 'Pw-for-tests-1', tenantId }, internal)).id);

		tenantA = Number((await svc('tenants').create({ name: `${stamp}-a`, description: 'A' }, internal)).id);
		tenantB = Number((await svc('tenants').create({ name: `${stamp}-b`, description: 'B' }, internal)).id);
		owner = await user('owner', tenantA);
		userA = await user('a', tenantA);
		userB = await user('b', tenantB);
		ownRoom = Number((await svc('rooms').create({ name: `${stamp}-own`, tenantId: tenantA }, internal)).id);
		otherRoom = Number((await svc('rooms').create({ name: `${stamp}-other`, tenantId: tenantA }, internal)).id);
		await svc('roomOwners').create({ roomId: ownRoom, userId: owner }, internal);
		otherOwnerRow = Number((await svc('roomOwners').create({ roomId: otherRoom, userId: userA }, internal)).id);
		roleA = Number((await svc('roles').create({ name: `${stamp}-ra`, description: 'A', tenantId: tenantA }, internal)).id);
		roleB = Number((await svc('roles').create({ name: `${stamp}-rb`, description: 'B', tenantId: tenantB }, internal)).id);
		groupA = Number((await svc('groups').create({ name: `${stamp}-ga`, tenantId: tenantA }, internal)).id);
		groupB = Number((await svc('groups').create({ name: `${stamp}-gb`, tenantId: tenantB }, internal)).id);
		otherGroupRole = Number((await svc('roomGroupRoles').create({ roomId: otherRoom, groupId: groupA, roleId: roleA }, internal)).id);
	});

	after(async () => {
		for (const [ path, query ] of [
			[ 'roomGroupRoles', { roomId: { $in: [ ownRoom, otherRoom ] } } ],
			[ 'roomUserRoles', { roomId: { $in: [ ownRoom, otherRoom ] } } ],
			[ 'roomOwners', { roomId: { $in: [ ownRoom, otherRoom ] } } ],
		] as const) {
			const rows = await svc(path).find({ ...internal, query, paginate: false }) as Array<{ id: number }>;

			for (const row of rows) await svc(path).remove(row.id, internal);
		}
		for (const id of [ ownRoom, otherRoom ]) if (id) await svc('rooms').remove(id, internal);
		for (const id of [ roleA, roleB ]) if (id) await svc('roles').remove(id, internal);
		for (const id of [ groupA, groupB ]) if (id) await svc('groups').remove(id, internal);
		for (const id of [ owner, userA, userB ]) if (id) await svc('users').remove(id, internal);
		for (const id of [ tenantA, tenantB ]) if (id) await svc('tenants').remove(id, internal);
	});

	describe('a room owner', () => {
		it('cannot change another room\'s group role, by its id or by naming the own room', async () => {
			await assert.rejects(svc('roomGroupRoles').patch(otherGroupRole, { roleId: roleA }, asOwner()), /not an owner/);
			await assert.rejects(svc('roomGroupRoles').patch(otherGroupRole, { roomId: ownRoom }, asOwner()), /not an owner/);
			assert.strictEqual(Number((await svc('roomGroupRoles').get(otherGroupRole, internal)).roomId), otherRoom);
		});

		it('cannot take over another room\'s owner row by naming the own room', async () => {
			await assert.rejects(svc('roomOwners').patch(otherOwnerRow, { roomId: ownRoom, userId: owner }, asOwner()), /not an owner/);
			assert.strictEqual(Number((await svc('roomOwners').get(otherOwnerRow, internal)).userId), userA);
		});

		it('still manages the own room', async () => {
			const row = await svc('roomGroupRoles').create({ roomId: ownRoom, groupId: groupA, roleId: roleA }, asOwner());

			await svc('roomGroupRoles').remove(row.id, asOwner());
		});
	});

	describe('rights handed out', () => {
		it('must name a group, role and user of the own tenant', async () => {
			await assert.rejects(svc('roomGroupRoles').create({ roomId: ownRoom, groupId: groupB, roleId: roleA }, asAdmin()), /groupId must belong/);
			await assert.rejects(svc('roomGroupRoles').create({ roomId: ownRoom, groupId: groupA, roleId: roleB }, asAdmin()), /roleId must belong/);
			await assert.rejects(svc('roomUserRoles').create({ roomId: ownRoom, userId: userB, roleId: roleA }, asAdmin()), /userId must belong/);
			await assert.rejects(svc('roomOwners').create({ roomId: ownRoom, userId: userB }, asAdmin()), /userId must belong/);
			await assert.rejects(svc('rooms').patch(ownRoom, { defaultRoleId: roleB }, asAdmin()), /defaultRoleId must belong/);
		});

		it('works with the own tenant\'s ones', async () => {
			const row = await svc('roomUserRoles').create({ roomId: ownRoom, userId: userA, roleId: roleA }, asAdmin());

			await svc('roomUserRoles').remove(row.id, asAdmin());
			await svc('rooms').patch(ownRoom, { defaultRoleId: roleA }, asAdmin());
		});
	});

	describe('resolved users', () => {
		it('are only seen and removed by the user who resolved them', async () => {
			const asUser = (id: number): Params => ({ provider: 'rest', authenticated: true, user: { id, tenantId: tenantA, roles: [] }, query: {} }) as unknown as Params;
			const mine = await svc('resolvedUsers').create({ resolvedUserId: userA }, asUser(owner));
			const seen = await svc('resolvedUsers').find({ ...asUser(userA), paginate: false }) as Array<{ id: number }>;

			assert.ok(!seen.some((row) => Number(row.id) === Number(mine.id)));
			await assert.rejects(svc('resolvedUsers').remove(mine.id, asUser(userA)));
			await svc('resolvedUsers').remove(mine.id, asUser(owner));
		});
	});
});
