import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

for (const path of [ 'tenantAdmins', 'tenantOwners' ] as const) {
	describe(`${path} across tenants`, () => {
		let tenantA: number;
		let tenantB: number;
		let userA: number;
		let userB: number;

		const adminOfA = (): Params => ({
			provider: 'rest',
			authenticated: true,
			user: { id: 903, tenantId: tenantA, tenantAdmin: true, roles: [] as string[] },
			query: {},
		}) as unknown as Params;

		const service = () => app.service(path) as unknown as {
			create: (data: Record<string, unknown>, params?: Params) => Promise<{ id: number, tenantId: number, userId: number }>
			patch: (id: number, data: Record<string, unknown>, params?: Params) => Promise<{ id: number, tenantId: number, userId: number }>
			remove: (id: number, params?: Params) => Promise<unknown>
			find: (params?: Params) => Promise<unknown>
		};
		const rowsOf = async (tenantId: number) =>
			service().find({ ...internal, query: { tenantId }, paginate: false } as unknown as Params) as unknown as Promise<Array<{ id: number, userId: number }>>;

		before(async () => {
			const stamp = `${path}-${Date.now()}`;

			tenantA = Number((await app.service('tenants').create({ name: `${stamp}-a`, description: 'tenant A' }, internal)).id);
			tenantB = Number((await app.service('tenants').create({ name: `${stamp}-b`, description: 'tenant B' }, internal)).id);
			userA = Number((await app.service('users').create({ email: `${stamp}-a@example.edu`, password: 'Pw-for-tests-1', tenantId: tenantA }, internal)).id);
			userB = Number((await app.service('users').create({ email: `${stamp}-b@example.edu`, password: 'Pw-for-tests-1', tenantId: tenantB }, internal)).id);
		});

		afterEach(async () => {
			for (const tenantId of [ tenantA, tenantB ]) {
				for (const row of await rowsOf(tenantId)) await service().remove(row.id, internal);
			}
		});

		after(async () => {
			for (const id of [ userA, userB ]) if (id) await app.service('users').remove(id, internal);
			for (const id of [ tenantA, tenantB ]) if (id) await app.service('tenants').remove(id, internal);
		});

		it('refuses to name a user of another tenant', async () => {
			await assert.rejects(service().create({ tenantId: tenantB, userId: userB }, adminOfA()), /belong to your tenant/);
			await assert.rejects(service().create({ tenantId: tenantA, userId: userB }, adminOfA()), /belong to your tenant/);
			assert.strictEqual((await rowsOf(tenantB)).length, 0);
		});

		it('creates the row in the own tenant, whatever tenantId was sent', async () => {
			const created = await service().create({ tenantId: tenantB, userId: userA }, adminOfA());

			assert.strictEqual(Number(created.tenantId), tenantA);
			assert.strictEqual((await rowsOf(tenantB)).length, 0);
		});

		it('keeps a patched row in the own tenant and its user in the own tenant', async () => {
			const created = await service().create({ tenantId: tenantA, userId: userA }, adminOfA());

			await assert.rejects(service().patch(created.id, { userId: userB }, adminOfA()), /belong to your tenant/);

			const patched = await service().patch(created.id, { tenantId: tenantB }, adminOfA());

			assert.strictEqual(Number(patched.tenantId), tenantA);
			assert.strictEqual(Number(patched.userId), userA);
		});

		it('cannot patch a row of another tenant', async () => {
			const foreign = await service().create({ tenantId: tenantB, userId: userB }, internal);

			await assert.rejects(service().patch(foreign.id, { userId: userA }, adminOfA()));
			assert.strictEqual(Number((await rowsOf(tenantB))[0].userId), userB);
		});

		it('still lets a super admin write any tenant', async () => {
			const superAdmin = { provider: 'rest', authenticated: true, user: { id: 1, roles: [ 'super-admin' ] }, query: {} } as unknown as Params;
			const created = await service().create({ tenantId: tenantB, userId: userB }, superAdmin);

			assert.strictEqual(Number(created.tenantId), tenantB);
		});
	});
}
