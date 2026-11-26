import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// A room's id comes from the database. The room server keeps live rooms by this id, so a
// caller who could choose it could take the id of a room that was deleted during its meeting.
describe('room ids are assigned by the server', () => {
	const stamp = `room-ids-${Date.now()}`;
	let tenant: number;
	let user: number;
	let room: number;
	const created: number[] = [];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svc = (path: string) => app.service(path as any) as any;
	const as = (roles: string[]): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: user, tenantId: tenant, tenantAdmin: false, tenantOwner: false, roles },
		query: {},
	}) as unknown as Params;
	const asUser = () => as([]);
	const asSuperAdmin = () => as([ 'super-admin' ]);
	const exists = async (id: number) =>
		(await svc('rooms').find({ ...internal, query: { id }, paginate: false })).length > 0;

	before(async () => {
		tenant = Number((await svc('tenants').create({ name: stamp, description: 'ids' }, internal)).id);
		user = Number((await svc('users').create({ email: `${stamp}@example.edu`, password: 'Pw-for-tests-1', tenantId: tenant }, internal)).id);
		room = Number((await svc('rooms').create({ name: `${stamp}-own` }, asUser())).id);
		created.push(room);
	});

	after(async () => {
		for (const id of created) if (await exists(id)) await svc('rooms').remove(id, internal);
		if (user) await svc('users').remove(user, internal);
		if (tenant) await svc('tenants').remove(tenant, internal);
	});

	it('refuses a chosen id when a user creates a room', async () => {
		const wanted = room + 1000;

		created.push(wanted);
		await assert.rejects(svc('rooms').create({ id: wanted, name: `${stamp}-chosen` }, asUser()), { name: 'BadRequest' });
		assert.strictEqual(await exists(wanted), false);
	});

	it('refuses the id of a deleted room', async () => {
		const freed = Number((await svc('rooms').create({ name: `${stamp}-freed` }, asUser())).id);

		created.push(freed);
		await svc('rooms').remove(freed, internal);
		await assert.rejects(svc('rooms').create({ id: freed, name: `${stamp}-again` }, asUser()), { name: 'BadRequest' });
		assert.strictEqual(await exists(freed), false);
	});

	it('refuses a chosen id from a super admin and from the server itself', async () => {
		const wanted = room + 2000;

		created.push(wanted, wanted + 1);
		await assert.rejects(
			svc('rooms').create({ id: wanted, name: `${stamp}-admin`, tenantId: tenant }, asSuperAdmin()),
			{ name: 'BadRequest' }
		);
		await assert.rejects(
			svc('rooms').create({ id: wanted + 1, name: `${stamp}-internal`, tenantId: tenant }, internal),
			{ name: 'BadRequest' }
		);
		assert.strictEqual(await exists(wanted), false);
		assert.strictEqual(await exists(wanted + 1), false);
	});

	// The database adapter leaves the id out of a patch. This test is here so that a change of
	// adapter does not bring the same problem back through a patch.
	it('does not change a room\'s id on a patch', async () => {
		const wanted = room + 3000;

		created.push(wanted);
		assert.strictEqual(Number((await svc('rooms').patch(room, { id: wanted, description: 'moved?' }, asUser())).id), room);
		assert.strictEqual(Number((await svc('rooms').patch(room, { id: wanted }, asSuperAdmin())).id), room);
		assert.strictEqual(await exists(room), true);
		assert.strictEqual(await exists(wanted), false);
	});

	it('still creates and changes rooms without an id', async () => {
		const made = await svc('rooms').create({ name: `${stamp}-plain`, description: 'first' }, asUser());

		created.push(Number(made.id));
		assert.ok(Number(made.id) > room);
		assert.strictEqual((await svc('rooms').patch(made.id, { description: 'second' }, asUser())).description, 'second');
	});
});
