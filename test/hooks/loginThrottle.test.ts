import assert from 'assert';
import http from 'http';
import type { AddressInfo } from 'net';
import axios from 'axios';
import { app } from '../../src/app';
import { loginThrottleBefore, loginThrottleError } from '../../src/hooks/loginThrottle';
import type { HookContext } from '../../src/declarations';

const failedLogin = (ip?: string) => ({
	params: { provider: 'rest', ip, headers: {} },
	data: { strategy: 'local', email: 'someone@example.org', password: 'wrong' },
	error: { code: 401 },
}) as unknown as HookContext;

const isBlocked = async (ip?: string) => {
	try {
		await loginThrottleBefore(failedLogin(ip));

		return false;
	} catch (error) {
		return (error as { code?: number }).code === 429;
	}
};

describe('login throttle', () => {
	it('counts failures per client address, so one client cannot block the others', async () => {
		const attacker = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

		for (let i = 0; i < 10; i++) await loginThrottleError(failedLogin(attacker));

		assert.strictEqual(await isBlocked(attacker), true);
		assert.strictEqual(await isBlocked('203.0.113.9'), false);
	}).timeout(10000);

	it('never puts clients without an address into one shared bucket', async () => {
		for (let i = 0; i < 12; i++) await loginThrottleError(failedLogin(undefined));

		assert.strictEqual(await isBlocked(undefined), false);
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
