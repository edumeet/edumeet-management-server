/* eslint-disable camelcase */
import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

const idp = (over: Record<string, unknown> = {}) => ({
	key: 'client',
	secret: 's1',
	authorize_url: 'https://idp.example/auth',
	access_url: 'https://idp.example/token',
	profile_url: 'https://idp.example/userinfo',
	...over
});

describe('tenantOAuths service', () => {
	describe('as a tenant admin over the API', () => {
		let tenantA: number;
		let tenantB: number;

		const adminOfA = (): Params => ({
			provider: 'rest',
			authenticated: true,
			user: { id: 902, tenantId: tenantA, tenantAdmin: true, roles: [] as string[] },
			query: {},
		}) as unknown as Params;

		const rowsOf = async (tenantId: number) =>
			app.service('tenantOAuths').find({ ...internal, query: { tenantId }, paginate: false }) as unknown as Promise<Array<{ id: number }>>;
		const loadedProvider = (tenantId: number) => (app.get('authentication')?.oauth as Record<string, unknown> | undefined)?.[tenantId];

		before(async () => {
			tenantA = Number((await app.service('tenants').create({ name: `oauth-a-${Date.now()}`, description: 'oauth tenant A' }, internal)).id);
			tenantB = Number((await app.service('tenants').create({ name: `oauth-b-${Date.now()}`, description: 'oauth tenant B' }, internal)).id);
		});

		afterEach(async () => {
			for (const tenantId of [ tenantA, tenantB ]) {
				for (const row of await rowsOf(tenantId)) await app.service('tenantOAuths').remove(row.id, internal);
			}
		});

		after(async () => {
			if (tenantA) await app.service('tenants').remove(tenantA, internal);
			if (tenantB) await app.service('tenants').remove(tenantB, internal);
		});

		it('creates the configuration in the own tenant, whatever tenantId was sent', async () => {
			const created = await app.service('tenantOAuths').create({ tenantId: tenantB, ...idp() }, adminOfA());

			assert.strictEqual(Number(created.tenantId), tenantA);
			assert.strictEqual((await rowsOf(tenantB)).length, 0);
			assert.strictEqual(loadedProvider(tenantB), undefined);
		});

		it('keeps the configuration in the own tenant when a patch sends another tenantId', async () => {
			const created = await app.service('tenantOAuths').create({ tenantId: tenantA, ...idp() }, adminOfA());

			await app.service('tenantOAuths').patch(created.id, { tenantId: tenantB, authorize_url: 'https://idp.example/auth2' }, adminOfA());

			const [ row ] = await rowsOf(tenantA);

			assert.ok(row, 'still in tenant A');
			assert.strictEqual((await rowsOf(tenantB)).length, 0);
			assert.strictEqual(loadedProvider(tenantB), undefined);
		});
	});
});
