import assert from 'assert';
import http from 'http';
import type { AddressInfo } from 'net';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { addressKey, checkRoomServerAddresses, loginThrottle } from '../../src/hooks/loginThrottle';
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
		app,
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
describe('login throttle on a whole login', () => {
	const password = 'a-long-unique-password-1';
	const users: number[] = [];
	const strategy = () => app.service('authentication').getStrategy('local') as unknown as {
		// eslint-disable-next-line no-unused-vars
		comparePassword: (entity: unknown, password: string) => Promise<unknown>;
	};

	const newAccount = async (roles?: string[]) => {
		const email = `throttle-${Date.now()}-${++serial}@throttle.example`;
		const mysql = [ 'mysql', 'mysql2' ].includes(app.get('postgresql')?.client ?? '');
		const roleColumn = roles ? { roles: mysql ? JSON.stringify(roles) : roles } : {};
		const [ created ] = await app.get('postgresqlClient')('users')
			.insert({ email, name: 'User', tenantId: null, password: bcrypt.hashSync(password, 4), ...roleColumn })
			.returning('id');

		users.push(Number(created.id ?? created));

		return email;
	};

	const login = async (email: string, ip: string, pw = 'a-wrong-password-of-some-length', forwardedFor?: string) => {
		const headers = forwardedFor ? { 'x-forwarded-for': forwardedFor } : {};

		try {
			await app.service('authentication').create({ strategy: 'local', email, password: pw }, { provider: 'rest', ip, headers });

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

	const strangersUseUpTheirLimits = async (email: string) => {
		for (let i = 0; i < 3; i++) {
			const stranger = freshV4();
			const codes = await Promise.all(Array.from({ length: 15 }, () => login(email, stranger)));

			assert.strictEqual(count(codes, 401), MAX);
		}
	};

	it('does not shut the owner of an ordinary account out after others used up their limits on it', async () => {
		const email = await newAccount();

		await strangersUseUpTheirLimits(email);
		assert.strictEqual(await login(email, freshV4(), password), 200);
	}).timeout(10000);

	const lockedSuperAdmin = async () => {
		const email = await newAccount([ 'super-admin' ]);

		await Promise.all(Array.from({ length: MAX }, () => login(email, freshV4())));
		assert.strictEqual(await login(email, freshV4(), password), 429);

		return email;
	};

	for (const role of [ 'super-admin', 'edumeet-server' ]) {
		it(`compares the password of a ${role} account for at most ten of a burst from many addresses`, async () => {
			const email = await newAccount([ role ]);
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
			} finally {
				local.comparePassword = compare;
			}

			assert.strictEqual(await login(email, freshV4(), password), 429);
		}).timeout(10000);
	}

	it('lets a room server on the same machine or network sign in to a super admin account others have locked', async () => {
		const email = await lockedSuperAdmin();

		for (const address of [ '172.20.0.5', '::ffff:172.20.0.5', '10.1.2.3', '192.168.1.1', '127.0.0.1', '::1', 'fd00::5' ]) {
			assert.strictEqual(await login(email, address, password), 200, address);
		}
	}).timeout(10000);

	it('gives the place on a super admin account back after each login', async () => {
		const email = await newAccount([ 'super-admin' ]);

		for (let i = 0; i < 12; i++) assert.strictEqual(await login(email, freshV4(), password), 200);
	}).timeout(10000);

	it('behind a proxy, takes the address the proxy saw and not one the client wrote', async () => {
		const email = await lockedSuperAdmin();
		const trustProxy = process.env.TRUST_PROXY;

		process.env.TRUST_PROXY = 'true';
		try {
			assert.strictEqual(await login(email, '10.0.0.5', password, `10.0.0.1, ${freshV4()}`), 429);
			assert.strictEqual(await login(email, freshV4(), password, `${freshV4()}, 10.0.0.1`), 200);
		} finally {
			if (trustProxy === undefined) delete process.env.TRUST_PROXY;
			else process.env.TRUST_PROXY = trustProxy;
		}
	}).timeout(10000);

	it('counts attempts on a locked account against their address', async () => {
		const email = await lockedSuperAdmin();
		const ordinary = await newAccount();
		const client = freshV4();

		const codes = await Promise.all(Array.from({ length: MAX }, () => login(email, client, password)));

		assert.strictEqual(count(codes, 429), MAX);
		assert.strictEqual(await login(ordinary, client, password), 429);
	}).timeout(10000);

	describe('with room server addresses set', () => {
		const roomServer = freshV4();

		before(() => {
			process.env.ROOM_SERVER_ADDRESSES = `${roomServer}, 2001:db8:ffff::/48`;
		});
		after(() => {
			delete process.env.ROOM_SERVER_ADDRESSES;
		});

		it('lets the listed room servers sign in to a super admin account others have locked', async () => {
			const email = await lockedSuperAdmin();

			for (const address of [ roomServer, `::ffff:${roomServer}`, '2001:db8:ffff:1::5' ]) {
				assert.strictEqual(await login(email, address, password), 200, address);
			}
		}).timeout(10000);

		it('refuses an entry that is not an address or a range', () => {
			try {
				for (const value of [ 'rooms.example.org', '198.51.100.7/', '198.51.100.0/33', '2001:db8::/129', '198.51.100.0/24/1' ]) {
					process.env.ROOM_SERVER_ADDRESSES = value;
					assert.throws(() => checkRoomServerAddresses(), /ROOM_SERVER_ADDRESSES/, value);
				}
			} finally {
				process.env.ROOM_SERVER_ADDRESSES = `${roomServer}, 2001:db8:ffff::/48`;
			}
		});
	});

	it('signs in when nothing is wrong', async () => {
		const email = await newAccount();
		const client = freshV4();

		for (let i = 0; i < 12; i++) assert.strictEqual(await login(email, client, password), 200);
	}).timeout(10000);
});
