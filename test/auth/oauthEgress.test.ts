/* eslint-disable camelcase */
import assert from 'assert';
import net from 'net';
import { app } from '../../src/app';
import type { Application } from '../../src/declarations';
import { isOwnNetworkAddress, oauthLookup, oauthUrlProblem, restrictOAuthRequests } from '../../src/auth/oauthEgress';

const withHosts = (oauthPrivateHosts: string[]) => ({ get: (name: string) => (name === 'oauthPrivateHosts' ? oauthPrivateHosts : undefined) }) as unknown as Application;

describe('tenant identity provider addresses', () => {
	it('counts loopback, private, link-local and mapped addresses as the server\'s own', () => {
		for (const address of [ '127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '64:ff9b::a00:1', 'not-an-ip' ])
			assert.strictEqual(isOwnNetworkAddress(address), true, address);
		for (const address of [ '8.8.8.8', '158.37.0.1', '2001:700::1' ])
			assert.strictEqual(isOwnNetworkAddress(address), false, address);
	});

	it('accept only https URLs without credentials and without private addresses', async () => {
		const none = withHosts([]);

		assert.strictEqual(await oauthUrlProblem(none, 'https://idp.example/token'), undefined);
		assert.strictEqual(await oauthUrlProblem(none, 'no url'), 'must be an absolute URL');
		assert.strictEqual(await oauthUrlProblem(none, 'http://idp.example/token'), 'must start with https://');
		assert.strictEqual(await oauthUrlProblem(none, 'https://u:p@idp.example/token'), 'must not contain a user name or password');

		for (const url of [ 'https://169.254.169.254/latest', 'https://[::1]/', 'https://10.0.0.5/token', 'https://localhost/token' ])
			assert.strictEqual(await oauthUrlProblem(none, url), 'must not point to a private or local address', url);
	});

	it('let the operator allow an identity provider on a private network, also over http', async () => {
		const keycloak = withHosts([ 'keycloak', '10.0.0.5' ]);

		assert.strictEqual(await oauthUrlProblem(keycloak, 'http://keycloak:8080/realms/x/protocol/openid-connect/token'), undefined);
		assert.strictEqual(await oauthUrlProblem(keycloak, 'https://10.0.0.5/token'), undefined);
		assert.strictEqual(await oauthUrlProblem(keycloak, 'http://idp.example/token'), 'must start with https://');
	});

	it('are resolved at connection time without the server\'s own addresses', async () => {
		const resolve = (application: Application, host: string) => new Promise<unknown>((resolveIt, reject) =>
			oauthLookup(application)(host, { all: true }, (err, addresses) => (err ? reject(err) : resolveIt(addresses))));

		await assert.rejects(resolve(withHosts([]), 'localhost'), /resolves only to private or local addresses/);
		assert.ok(Array.isArray(await resolve(withHosts([ 'localhost' ]), 'localhost')));
	});
});

describe('requests to a tenant identity provider', () => {
	it('never connect to the server\'s own host, even when its name resolves there', async () => {
		let connections = 0;
		const servers: net.Server[] = [];
		const listen = (host: string, port: number) => new Promise<number>((resolve, reject) => {
			const server = net.createServer((socket) => {
				connections++;
				socket.destroy();
			});

			server.once('error', reject);
			server.listen(port, host, () => {
				servers.push(server);
				resolve((server.address() as net.AddressInfo).port);
			});
		});
		const port = await listen('127.0.0.1', 0);

		await listen('::1', port).catch(() => undefined);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const providers = (app.get('authentication') as any).oauth as Record<string, unknown>;
		const id = '987654';

		providers[id] = {
			oauth: 2,
			key: 'client',
			secret: 's1',
			authorize_url: 'https://idp.example/auth',
			access_url: `https://localhost:${port}/token`,
			profile_url: `https://localhost:${port}/userinfo`,
			redirect_uri: 'https://mgmt.example/oauth/tenant/callback',
			dynamic: false
		};

		try {
			restrictOAuthRequests(app);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const service = app.service('oauth/:provider') as any;
			const result = await service.grant({
				method: 'GET',
				params: { provider: id, override: 'callback' },
				query: { code: 'c', state: 's' },
				session: { provider: id, state: 's' },
				state: {}
			});

			assert.strictEqual(connections, 0);
			assert.match(JSON.stringify(result), /resolves only to private or local addresses/);
		} finally {
			delete providers[id];
			restrictOAuthRequests(app);
			for (const server of servers) server.close();
		}
	});
});
