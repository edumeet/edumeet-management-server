import assert from 'assert';
import http from 'http';
import type { AddressInfo } from 'net';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { addressKey, loginThrottle } from '../../src/hooks/loginThrottle';
import type { HookContext } from '../../src/declarations';

const MAX = 10;

// Addresses no other test (or earlier run of this one, the state is in memory) has used.
let serial = 0;
const stamp = Math.floor(Math.random() * 200) + 1;
const freshV4 = () => `198.${stamp}.${Math.floor(++serial / 250)}.${(serial % 250) + 1}`;
const freshV6Net = () => `2001:db8:${stamp.toString(16)}:${(++serial).toString(16)}`;

const codeOf = (error: unknown) => (error as { code?: number }).code;

// One login through the hook alone; `outcome` is what the rest of the login does.
const attempt = async (ip: string | undefined, outcome: number | 'ok' = 401, onRun?: () => void) => {
	const context = {
		params: { provider: 'rest', ip, headers: {} },
		data: { strategy: 'local', email: 'someone@example.org', password: 'wrong' },
	} as unknown as HookContext;

	try {
		await loginThrottle(context, async () => {
			onRun?.();
			await new Promise((resolve) => setTimeout(resolve, 20));
			if (outcome !== 'ok') throw Object.assign(new Error('refused'), { code: outcome });
		});

		return 200;
	} catch (error) {
		return codeOf(error);
	}
};

const count = (codes: unknown[], code: number) => codes.filter((c) => c === code).length;

describe('login throttle', () => {
	it('counts failures per client address, so one client cannot block the others', async () => {
		const attacker = freshV4();

		await Promise.all(Array.from({ length: MAX }, () => attempt(attacker)));

		assert.strictEqual(await attempt(attacker, 'ok'), 429);
		assert.strictEqual(await attempt(freshV4(), 'ok'), 200);
	});

	it('never puts clients without an address into one shared bucket', async () => {
		for (let i = 0; i < 12; i++) assert.strictEqual(await attempt(undefined), 401);

		assert.strictEqual(await attempt(undefined, 'ok'), 200);
	}).timeout(10000);

	it('lets only as many of a burst through as may fail, and refuses the rest', async () => {
		const attacker = freshV4();
		let evaluated = 0;

		const codes = await Promise.all(Array.from({ length: 40 }, () => attempt(attacker, 401, () => evaluated++)));

		assert.strictEqual(evaluated, MAX);
		assert.strictEqual(count(codes, 401), MAX);
		assert.strictEqual(count(codes, 429), 30);
	});

	it('counts the attempts still running together with the failures before them', async () => {
		const attacker = freshV4();
		let evaluated = 0;

		for (let i = 0; i < 7; i++) await attempt(attacker);
		await Promise.all(Array.from({ length: 20 }, () => attempt(attacker, 401, () => evaluated++)));

		assert.strictEqual(evaluated, MAX - 7);
	}).timeout(10000);

	it('gives the place back when the login succeeds or fails for another reason', async () => {
		const client = freshV4();

		for (let i = 0; i < 15; i++) assert.strictEqual(await attempt(client, 'ok'), 200);
		for (let i = 0; i < 15; i++) assert.strictEqual(await attempt(client, 500), 500);

		assert.strictEqual(await attempt(client, 'ok'), 200);
	});

	it('takes an IPv6 /64 for one client', async () => {
		const net = freshV6Net();

		await Promise.all(Array.from({ length: MAX }, (_, i) => attempt(`${net}:${i + 1}:2:3:4`)));

		assert.strictEqual(await attempt(`${net}::99`, 'ok'), 429);
		assert.strictEqual(await attempt(`${freshV6Net()}::99`, 'ok'), 200);
	});

	it('names an address by what identifies the client', () => {
		for (const [ address, key ] of [
			[ '198.51.100.7', '198.51.100.7' ],
			[ '::ffff:198.51.100.7', '198.51.100.7' ],
			[ '::FFFF:c633:6407', '198.51.100.7' ],
			[ '2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64' ],
			[ '2001:0DB8:0001:0002::1', '2001:db8:1:2::/64' ],
			[ '2001:db8::1', '2001:db8:0:0::/64' ],
			[ '2001:db8:1:2::198.51.100.7', '2001:db8:1:2::/64' ],
			[ 'fe80::1%eth0', 'fe80:0:0:0::/64' ],
			[ '::1', '0:0:0:0::/64' ],
			[ 'not an address', 'not an address' ],
		]) assert.strictEqual(addressKey(address), key, address);
	});

	it('receives the client address over REST', async () => {
		const seen: unknown[] = [];

		app.service('authentication').hooks({ before: { create: [ async (context: HookContext) => { seen.push(context.params.ip); } ] } });

		const server = http.createServer(app.callback());

		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const { port } = server.address() as AddressInfo;

			await axios.post(`http://127.0.0.1:${port}/authentication`, { strategy: 'local', email: 'nobody@example.org', password: 'wrong' })
				.catch(() => undefined);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}

		assert.ok(seen.some((ip) => typeof ip === 'string' && ip.endsWith('127.0.0.1')), `saw ${JSON.stringify(seen)}`);
	});
});

// The whole login, as a client outside reaches it: hook, strategy and database.
describe('login throttle per account', () => {
	const password = 'a-long-unique-password-1';
	const users: number[] = [];
	const strategy = () => app.service('authentication').getStrategy('local') as unknown as {
		// eslint-disable-next-line no-unused-vars
		comparePassword: (entity: unknown, password: string) => Promise<unknown>;
	};

	const newAccount = async () => {
		const email = `throttle-${Date.now()}-${++serial}@throttle.example`;
		const [ created ] = await app.get('postgresqlClient')('users')
			.insert({ email, name: 'User', tenantId: null, password: bcrypt.hashSync(password, 4) })
			.returning('id');

		users.push(Number(created.id ?? created));

		return email;
	};

	const login = async (email: string, ip: string, pw = 'a-wrong-password-of-some-length') => {
		try {
			await app.service('authentication').create({ strategy: 'local', email, password: pw }, { provider: 'rest', ip, headers: {} });

			return 200;
		} catch (error) {
			return codeOf(error);
		}
	};

	after(async () => {
		for (const id of users) await app.get('postgresqlClient')('users').where({ id })
			.delete();
	});

	it('compares the password for at most ten of a burst from one address', async () => {
		const email = await newAccount();
		const attacker = freshV4();
		const local = strategy();
		const compare = local.comparePassword;
		let compared = 0;

		local.comparePassword = function(...args) {
			compared++;

			return compare.apply(this, args);
		};

		try {
			const codes = await Promise.all(Array.from({ length: 40 }, () => login(email, attacker)));

			assert.strictEqual(compared, MAX);
			assert.strictEqual(count(codes, 401), MAX);
			assert.strictEqual(count(codes, 429), 30);
		} finally {
			local.comparePassword = compare;
		}
	}).timeout(10000);

	it('limits the guesses at one account from many addresses', async () => {
		const email = await newAccount();
		const local = strategy();
		const compare = local.comparePassword;
		let compared = 0;

		local.comparePassword = function(...args) {
			compared++;

			return compare.apply(this, args);
		};

		try {
			const codes = await Promise.all(Array.from({ length: 40 }, () => login(email, freshV4())));

			assert.strictEqual(compared, MAX);
			assert.strictEqual(count(codes, 401), MAX);
			assert.strictEqual(count(codes, 429), 30);

			// Blocked now, for the right password too: the answer must not tell a guess was right.
			assert.strictEqual(await login(email, freshV4(), password), 429);
			assert.strictEqual(await login(email, `${freshV6Net()}::1`, password), 429);
			assert.strictEqual(compared, MAX);
		} finally {
			local.comparePassword = compare;
		}
	}).timeout(10000);

	it('does not let the spelling of the address start a new count, or tell that it has an account', async () => {
		const email = await newAccount();

		await Promise.all(Array.from({ length: MAX }, () => login(email, freshV4())));

		// Whether these find the account is up to the database. If they do it is the same account,
		// and if they do not the answer is still the one an address without an account gets.
		for (const spelling of [ email.toUpperCase(), `${email} `, email.replace('throttle-', 'thrôttle-') ]) {
			assert.strictEqual(await login(spelling, freshV4(), password), 429, spelling);
		}
	}).timeout(10000);

	it('still signs the owner in from an address that signed in before', async () => {
		const email = await newAccount();
		const home = freshV4();

		assert.strictEqual(await login(email, home, password), 200);

		await Promise.all(Array.from({ length: MAX }, () => login(email, freshV4())));

		assert.strictEqual(await login(email, freshV4(), password), 429);
		assert.strictEqual(await login(email, home, password), 200);

		// That address has its own limit left, nothing more.
		const codes = await Promise.all(Array.from({ length: 15 }, () => login(email, home)));

		assert.strictEqual(count(codes, 401), MAX);
		assert.strictEqual(await login(email, home, password), 429);
	}).timeout(10000);

	it('knows an address for the account it signed in to only', async () => {
		const email = await newAccount();
		const other = await newAccount();
		const home = freshV4();

		assert.strictEqual(await login(other, home, password), 200);

		await Promise.all(Array.from({ length: MAX }, () => login(email, freshV4())));

		assert.strictEqual(await login(email, home, password), 429);
	}).timeout(10000);

	it('answers for an address without an account as for one with', async () => {
		const email = `nobody-${Date.now()}@throttle.example`;

		const codes = await Promise.all(Array.from({ length: 25 }, () => login(email, freshV4())));

		assert.strictEqual(count(codes, 401), MAX);
		assert.strictEqual(count(codes, 429), 15);
		assert.strictEqual(await login(email.toUpperCase(), freshV4()), 429);
	}).timeout(10000);

	it('tries the password only on the accounts of an address that take another guess', async () => {
		const email = await newAccount();
		const second = 'another-long-unique-password-2';
		const home = freshV4();
		const [ created ] = await app.get('postgresqlClient')('users')
			.insert({ email, name: 'User', tenantId: null, password: bcrypt.hashSync(second, 4) })
			.returning('id');

		users.push(Number(created.id ?? created));

		// Known for the second account only; strangers then use up the limit of both.
		assert.strictEqual(await login(email, home, second), 200);
		await Promise.all(Array.from({ length: MAX }, () => login(email, freshV4())));

		assert.strictEqual(await login(email, home, second), 200);
		assert.strictEqual(await login(email, home, password), 401);
	}).timeout(10000);

	it('signs in when nothing is wrong', async () => {
		const email = await newAccount();
		const client = freshV4();

		for (let i = 0; i < 12; i++) assert.strictEqual(await login(email, client, password), 200);
	}).timeout(10000);
});
