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
