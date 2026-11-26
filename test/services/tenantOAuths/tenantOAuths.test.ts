/* eslint-disable camelcase */
import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';
import { answerReservedNamesLocally } from '../../auth/reservedNames';

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
	let restoreDns: () => void;

	before(() => {
		restoreDns = answerReservedNamesLocally();
	});

	after(() => restoreDns());

	describe('as a tenant admin over the API', () => {
		let tenantA: number;
		let tenantB: number;

		const adminOfA = (): Params => ({
			provider: 'rest',
			authenticated: true,
			user: { id: 902, tenantId: tenantA, tenantAdmin: true, roles: [] as string[] },
			query: {},
		}) as unknown as Params;

		const superAdmin = (): Params => ({
			provider: 'rest',
			authenticated: true,
			user: { id: 901, roles: [ 'super-admin' ] },
			query: {},
		}) as unknown as Params;

		const rowOf = async (id: number) =>
			app.service('tenantOAuths').get(id, internal) as unknown as Promise<Record<string, unknown>>;

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

		it('leaves creating the configuration to a super admin', async () => {
			await assert.rejects(app.service('tenantOAuths').create({ tenantId: tenantA, ...idp() }, adminOfA()), { code: 403 });

			assert.strictEqual((await rowsOf(tenantA)).length, 0);
			assert.strictEqual(loadedProvider(tenantA), undefined);
		});

		it('refuses a tenant admin a change of where the sign-in goes', async () => {
			const created = await app.service('tenantOAuths').create({ tenantId: tenantA, ...idp({ end_session_endpoint: 'https://idp.example/logout' }) }, superAdmin());

			for (const key of [ 'authorize_url', 'access_url', 'profile_url', 'end_session_endpoint' ]) {
				await assert.rejects(app.service('tenantOAuths').patch(created.id, { [key]: 'https://attacker.example/x' }, adminOfA()), { code: 403 }, key);
			}

			const row = await rowOf(created.id);

			assert.strictEqual(row.access_url, 'https://idp.example/token');
			assert.strictEqual(row.end_session_endpoint, 'https://idp.example/logout');
		});

		it('lets a tenant admin set the client id, secret and scope, with the addresses sent along unchanged', async () => {
			const created = await app.service('tenantOAuths').create({ tenantId: tenantA, ...idp({ key: '', secret: '' }) }, superAdmin());
			const { authorize_url, access_url, profile_url } = idp();

			await app.service('tenantOAuths').patch(created.id, { authorize_url, access_url, profile_url, end_session_endpoint: '', key: 'client-a', secret: 's2', scope: 'openid email' }, adminOfA());

			const row = await rowOf(created.id);

			assert.strictEqual(row.key, 'client-a');
			assert.strictEqual(row.secret, 's2');
			assert.strictEqual(row.scope, 'openid email');
		});

		it('lets a super admin set where the sign-in goes', async () => {
			const created = await app.service('tenantOAuths').create({ tenantId: tenantA, ...idp() }, superAdmin());

			await app.service('tenantOAuths').patch(created.id, { access_url: 'https://idp2.example/token' }, superAdmin());

			assert.strictEqual((await rowOf(created.id)).access_url, 'https://idp2.example/token');
		});

		it('answers a tenant admin with not found for the configuration of another tenant, whatever addresses are sent', async () => {
			const ofB = await app.service('tenantOAuths').create({ tenantId: tenantB, ...idp() }, superAdmin());

			for (const access_url of [ 'https://idp.example/token', 'https://attacker.example/token' ]) {
				await assert.rejects(app.service('tenantOAuths').patch(ofB.id, { access_url }, adminOfA()), { code: 404 }, access_url);
			}
		});

		it('refuses identity provider URLs that are not https or point to private addresses', async () => {
			for (const [ over, message ] of [
				[ { access_url: 'http://169.254.169.254/latest/meta-data' }, /access_url must start with https/ ],
				[ { profile_url: 'https://127.0.0.1:5432/' }, /profile_url must not point to a private or local address/ ],
				[ { access_url: 'https://localhost/token' }, /access_url must not point to a private or local address/ ],
				[ { authorize_url: 'https://user:pw@idp.example/auth' }, /authorize_url must not contain a user name or password/ ],
			] as const) {
				await assert.rejects(app.service('tenantOAuths').create({ tenantId: tenantA, ...idp(over) }, superAdmin()), message);
			}

			const created = await app.service('tenantOAuths').create({ tenantId: tenantA, ...idp() }, superAdmin());

			await assert.rejects(app.service('tenantOAuths').patch(created.id, { access_url: 'https://10.1.2.3/token' }, superAdmin()), /private or local/);
		});

		it('keeps the configuration in the own tenant when a patch sends another tenantId', async () => {
			const created = await app.service('tenantOAuths').create({ tenantId: tenantA, ...idp() }, superAdmin());

			await app.service('tenantOAuths').patch(created.id, { tenantId: tenantB, scope: 'openid' }, adminOfA());

			const [ row ] = await rowsOf(tenantA);

			assert.ok(row, 'still in tenant A');
			assert.strictEqual((await rowsOf(tenantB)).length, 0);
			assert.strictEqual(loadedProvider(tenantB), undefined);
		});
	});
});
