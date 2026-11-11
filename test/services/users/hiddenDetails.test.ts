import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// In a tenant that hides user details, a member sees another member's name and e-mail only
// after finding that member by the exact e-mail address.
describe('hidden user details', () => {
	const stamp = `hidden-${Date.now()}`;
	const targetEmail = `${stamp}-target@example.edu`;
	let tenant: number;
	let member: number;
	let target: number;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svc = (path: string) => app.service(path as any) as any;
	const as = (id: number, extra: Record<string, unknown> = {}): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id, tenantId: tenant, tenantAdmin: false, tenantOwner: false, roles: [] as string[], ...extra },
		query: {},
	}) as unknown as Params;

	before(async () => {
		tenant = Number((await svc('tenants').create({ name: stamp, description: 'hidden', hideUserDetails: true }, internal)).id);
		member = Number((await svc('users').create({ email: `${stamp}-member@example.edu`, password: 'Pw-for-tests-1', tenantId: tenant }, internal)).id);
		target = Number((await svc('users').create({ email: targetEmail, name: 'Target Person', password: 'Pw-for-tests-1', tenantId: tenant }, internal)).id);
	});

	after(async () => {
		const rows = await svc('resolvedUsers').find({ ...internal, query: { userId: member }, paginate: false });

		for (const row of rows) await svc('resolvedUsers').remove(row.id, internal);
		await svc('users').remove(target, internal);
		await svc('users').remove(member, internal);
		await svc('tenants').remove(tenant, internal);
	});

	it('are hidden, and cannot be revealed by naming a user id', async () => {
		const hidden = await svc('users').get(target, as(member));

		assert.strictEqual(hidden.email, undefined);
		assert.strictEqual(hidden.name, undefined);
		await assert.rejects(svc('resolvedUsers').create({ resolvedUserId: target }, as(member)), /Look the user up/);
	});

	it('cannot be narrowed down with comparisons or sorting on e-mail', async () => {
		await assert.rejects(svc('users').find({ ...as(member), query: { email: { $gt: '' } } }), /exact e-mail address/);
		await assert.rejects(svc('users').find({ ...as(member), query: { $sort: { email: 1 } } }), /exact e-mail address/);
	});

	it('are revealed after finding the user by the exact address', async () => {
		const found = await svc('users').find({ ...as(member), query: { email: targetEmail, $limit: 1, $sort: { id: 1 } } });

		assert.strictEqual(Number(found.data[0].id), target);
		await svc('resolvedUsers').create({ resolvedUserId: target }, as(member));

		const shown = await svc('users').get(target, as(member));

		assert.strictEqual(shown.email, targetEmail);
		assert.strictEqual(shown.name, 'Target Person');
	});

	it('are visible to a tenant admin, who may still search freely', async () => {
		await svc('users').find({ ...as(member, { tenantAdmin: true }), query: { email: { $gt: '' } } });
	});
});
