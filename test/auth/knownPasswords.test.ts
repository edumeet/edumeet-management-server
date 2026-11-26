import assert from 'assert';
import { spawnSync } from 'child_process';
import path from 'path';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';

const internal = { provider: undefined, query: {} };
const root = path.resolve(__dirname, '../..');

describe('publicly known passwords', () => {
	let tenantId: number;
	let userId: number;
	const email = `admin-${Date.now()}@acme.edu`;

	const passwordLogin = (password: string, as = email) =>
		app.service('authentication').getStrategy('local')!.authenticate!({ strategy: 'local', email: as, password }, {});
	const storedHash = async (): Promise<string> =>
		(await app.get('postgresqlClient')('users')
			.where({ id: userId })
			.first()).password;

	before(async () => {
		tenantId = Number((await app.service('tenants').create({ name: `pw-${Date.now()}`, description: 'known password test' }, internal)).id);

		// Like the seeded super-admin: the hash is written straight into the table.
		const [ row ] = await app.get('postgresqlClient')('users')
			.insert({ email, name: 'Admin', tenantId, password: bcrypt.hashSync('supersecret', 10) })
			.returning('id');

		userId = Number(row.id ?? row);
	});

	after(async () => {
		if (userId) await app.service('users').remove(userId, internal);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	for (const password of [ 'supersecret', 'supersecret2' ]) {
		it(`refuses "${password}" even when it is the account's password`, async () => {
			await assert.rejects(passwordLogin(password), /publicly known/);
		});
	}

	it('gives the same answer for an address without an account', async () => {
		await assert.rejects(passwordLogin('supersecret', 'nobody@acme.edu'), /publicly known/);
	});

	const setPassword = (args: string[], input: string) => spawnSync(
		process.execPath,
		[ '-r', 'ts-node/register', 'src/scripts/setPassword.ts', ...args ],
		{ cwd: root, input, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' }, timeout: 60000 }
	);

	it('lets an operator replace it with yarn set-password', async () => {
		const tooShort = setPassword([ email ], 'short\n');

		assert.notStrictEqual(tooShort.status, 0);
		assert.match(tooShort.stderr, /at least 12/);

		const known = setPassword([ email ], 'supersecret2\n');

		assert.notStrictEqual(known.status, 0);
		assert.ok(bcrypt.compareSync('supersecret', await storedHash()), 'unchanged after refusals');

		const done = setPassword([ email ], 'a-new-long-password\n');

		assert.strictEqual(done.status, 0, done.stderr);
		assert.ok(bcrypt.compareSync('a-new-long-password', await storedHash()));

		const result = await passwordLogin('a-new-long-password');

		assert.strictEqual(Number(result.user.id), userId);
	}).timeout(70000);

	it('refuses an unknown e-mail in yarn set-password', () => {
		const result = setPassword([ 'nobody@acme.edu' ], 'a-new-long-password\n');

		assert.notStrictEqual(result.status, 0);
		assert.match(result.stderr, /No user/);
	}).timeout(70000);
});

// An address is unique per tenant only, and an identity provider of a tenant can assert any
// address. Such an account must not stand between the operator and the super admin's password.
describe('yarn set-password and an address that several accounts have', () => {
	const knex = () => app.get('postgresqlClient');
	const email = `shared-${Date.now()}@acme.edu`;
	const tenants: number[] = [];
	const ids: Record<string, number> = {};

	const setPassword = (args: string[], input = 'a-new-long-password\n') => spawnSync(
		process.execPath,
		[ '-r', 'ts-node/register', 'src/scripts/setPassword.ts', ...args ],
		{ cwd: root, input, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' }, timeout: 60000 }
	);
	const hasNewPassword = async (who: string): Promise<boolean> =>
		bcrypt.compareSync('a-new-long-password', (await knex()('users').where({ id: ids[who] })
			.first()).password);
	const reset = () => knex()('users').whereIn('id', Object.values(ids))
		.update({ password: bcrypt.hashSync('the-old-long-password', 10) });

	before(async () => {
		for (const name of [ 'one', 'two' ])
			tenants.push(Number((await app.service('tenants').create({ name: `${name}-${Date.now()}`, description: 'set-password test' }, internal)).id));

		for (const [ who, tenantId ] of [ [ 'superAdmin', null ], [ 'inOne', tenants[0] ], [ 'inTwo', tenants[1] ] ] as Array<[ string, number | null ]>) {
			const [ row ] = await knex()('users').insert({ email, name: who, tenantId, password: bcrypt.hashSync('the-old-long-password', 10) })
				.returning('id');

			ids[who] = Number(row.id ?? row);
		}
	});

	after(async () => {
		await knex()('users').whereIn('id', Object.values(ids))
			.del();
		for (const tenantId of tenants) await app.service('tenants').remove(tenantId, internal);
	});

	it('without a tenant changes the account that belongs to no tenant', async () => {
		const result = setPassword([ email ]);

		assert.strictEqual(result.status, 0, result.stderr);
		assert.match(result.stdout, /no tenant/);
		assert.deepStrictEqual([ await hasNewPassword('superAdmin'), await hasNewPassword('inOne'), await hasNewPassword('inTwo') ], [ true, false, false ]);
	}).timeout(70000);

	it('with a tenant changes the account of that tenant', async () => {
		await reset();

		const result = setPassword([ email, String(tenants[1]) ]);

		assert.strictEqual(result.status, 0, result.stderr);
		assert.deepStrictEqual([ await hasNewPassword('superAdmin'), await hasNewPassword('inOne'), await hasNewPassword('inTwo') ], [ false, false, true ]);
	}).timeout(70000);

	it('refuses a tenant that has no such account', async () => {
		await reset();

		const result = setPassword([ email, '999999999' ]);

		assert.notStrictEqual(result.status, 0);
		assert.match(result.stderr, /No user .* in tenant 999999999/);
	}).timeout(70000);

	it('asks for the tenant when only tenants have the address, and changes none', async () => {
		await reset();
		await knex()('users').where({ id: ids.superAdmin })
			.update({ email: `gone-${email}` });

		const result = setPassword([ email ]);

		assert.notStrictEqual(result.status, 0);
		assert.match(result.stderr, /More than one user/);
		assert.ok(result.stderr.includes(`tenants: ${tenants[0]}, ${tenants[1]}`), result.stderr);
		assert.deepStrictEqual([ await hasNewPassword('inOne'), await hasNewPassword('inTwo') ], [ false, false ]);
	}).timeout(70000);
});
