import assert from 'assert';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';

const internal = { provider: undefined, query: {} };

// An e-mail address is unique per tenant only. A passwordless SSO account that an identity
// provider created in some tenant must not lock the local account with that address out.
describe('password login with an address that several accounts share', () => {
	const email = `local-${Date.now()}@shared.example`;
	const password = 'a-long-unique-password-1';
	const tenants: number[] = [];
	const users: number[] = [];

	const login = (pw = password) =>
		app.service('authentication').getStrategy('local')!.authenticate!({ strategy: 'local', email, password: pw }, {});
	const insertUser = async (row: Record<string, unknown>) => {
		const [ created ] = await app.get('postgresqlClient')('users')
			.insert({ email, name: 'User', ...row })
			.returning('id');

		users.push(Number(created.id ?? created));

		return users[users.length - 1];
	};
	const newTenant = async () => {
		const tenant = await app.service('tenants').create({ name: `shared-${Date.now()}-${tenants.length}`, description: 'shared e-mail test' }, internal);

		tenants.push(Number(tenant.id));

		return Number(tenant.id);
	};

	let localId: number;

	before(async () => {
		// An SSO account created first, so a lookup that takes the first row finds it.
		await insertUser({ tenantId: await newTenant(), ssoId: `sso-${Date.now()}-0` });

		// The local account, like the super admin or the room server's service account: no tenant.
		localId = await insertUser({ tenantId: null, password: bcrypt.hashSync(password, 10) });

		// SSO accounts with the same address in two tenants, without a password, inserted after it
		// and before it in id order.
		await insertUser({ tenantId: await newTenant(), ssoId: `sso-${Date.now()}-a` });
		await insertUser({ tenantId: await newTenant(), ssoId: `sso-${Date.now()}-b` });
	});

	after(async () => {
		for (const id of users) await app.get('postgresqlClient')('users').where({ id })
			.delete();
		for (const id of tenants) await app.service('tenants').remove(id, internal);
	});

	it('signs in the local account', async () => {
		const result = await login();

		assert.strictEqual(Number((result as { user: { id: number } }).user.id), localId);
	});

	it('still refuses a wrong password', async () => {
		await assert.rejects(login('a-long-unique-password-2'));
	});

	it('refuses when two accounts with a password accept it, rather than picking one', async () => {
		await insertUser({ tenantId: await newTenant(), password: bcrypt.hashSync(password, 10) });

		await assert.rejects(login());
	});
});
