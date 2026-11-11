/* eslint-disable camelcase */
import assert from 'assert';
import axios from 'axios';
import http from 'http';
import type { AddressInfo } from 'net';
import { app } from '../../src/app';
import type { Application } from '../../src/declarations';
import { isOwnNetworkAddress, oauthLookup, oauthUrlProblem } from '../../src/auth/oauthEgress';

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

// A complete sign in over HTTP, the way a browser and an identity provider drive it: the
// requests to the provider are made by the callback route.
describe('requests to a tenant identity provider', () => {
	const internal = { provider: undefined, query: {} };
	const baseUrl = `http://${app.get('host')}:${app.get('port')}`;
	const fqdn = `egress-${Date.now()}.example.edu`;
	const refused = 'Sign in at the identity provider failed. Ask your administrator.';
	const profile = { sub: 'egress-sub', email: `egress-${Date.now()}@example.edu`, email_verified: true, name: 'Egress' };
	const configuredHosts = app.get('oauthPrivateHosts');

	type Loopback = { port: number, connections: number, close: () => void };

	// The name localhost can resolve to either loopback address.
	const listenOnLoopback = async (handler: http.RequestListener): Promise<Loopback> => {
		const servers: http.Server[] = [];
		const loopback: Loopback = {
			port: 0,
			connections: 0,
			close: () => servers.forEach((server) => {
				server.closeAllConnections();
				server.close();
			})
		};
		const listen = (host: string, port: number) => new Promise<number>((resolve, reject) => {
			const server = http.createServer(handler);

			server.on('connection', () => { loopback.connections++; });
			server.once('error', reject);
			server.listen(port, host, () => {
				servers.push(server);
				resolve((server.address() as AddressInfo).port);
			});
		});

		loopback.port = await listen('127.0.0.1', 0);
		await listen('::1', loopback.port).catch(() => undefined);

		return loopback;
	};

	let tenantId: number;
	let fqdnId: number;
	let oauthId: number;
	let provider: Loopback;
	let elsewhere: Loopback;
	let requests: string[] = [];
	let profileRedirect: string | undefined;

	const signIn = async (): Promise<URL> => {
		const options = { maxRedirects: 0, validateStatus: () => true };
		const started = await axios.get(`${baseUrl}/oauth/tenant`, { ...options, params: { tenantId: String(tenantId), origin: `https://${fqdn}` } });
		const authorize = new URL(String(started.headers.location), baseUrl);

		assert.strictEqual(`${authorize.origin}${authorize.pathname}`, `http://localhost:${provider.port}/auth`);

		const cookie = (started.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ');
		const returned = await axios.get(`${baseUrl}/oauth/tenant/callback`, {
			...options,
			params: { code: 'c', state: authorize.searchParams.get('state') },
			headers: { cookie }
		});

		return new URL(String(returned.headers.location), baseUrl);
	};

	before(async () => {
		await app.listen(app.get('port'));

		provider = await listenOnLoopback((req, res) => {
			const path = String(req.url).split('?')[0];

			requests.push(`${req.method} ${path}`);
			req.resume();
			// No connection is kept for the next request: each one has to connect, and so resolve the name, again.
			res.setHeader('Connection', 'close');

			if (path === '/userinfo' && profileRedirect) {
				res.writeHead(302, { Location: profileRedirect }).end();

				return;
			}

			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(path === '/token' ? { access_token: 'at', token_type: 'Bearer' } : profile));
		});
		elsewhere = await listenOnLoopback((req, res) => {
			req.resume();
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(profile));
		});

		app.set('oauthPrivateHosts', [ 'localhost' ]);

		const tenant = await app.service('tenants').create({ name: `egress-${Date.now()}`, description: 'identity provider requests test' }, internal);

		tenantId = Number(tenant.id);
		fqdnId = Number((await app.service('tenantFQDNs').create({ tenantId, fqdn }, internal)).id);
		oauthId = Number((await app.service('tenantOAuths').create({
			tenantId,
			key: 'client',
			secret: 's1',
			authorize_url: `http://localhost:${provider.port}/auth`,
			access_url: `http://localhost:${provider.port}/token`,
			profile_url: `http://localhost:${provider.port}/userinfo`
		}, internal)).id);
	});

	beforeEach(() => {
		app.set('oauthPrivateHosts', [ 'localhost' ]);
		requests = [];
		profileRedirect = undefined;
		provider.connections = 0;
		elsewhere.connections = 0;
	});

	after(async () => {
		app.set('oauthPrivateHosts', configuredHosts);

		if (tenantId) {
			const users = await app.service('users').find({ ...internal, query: { tenantId }, paginate: false });

			for (const user of users) await app.service('users').remove(user.id, internal);
		}
		if (oauthId) await app.service('tenantOAuths').remove(oauthId, internal);
		if (fqdnId) await app.service('tenantFQDNs').remove(fqdnId, internal);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);

		provider?.close();
		elsewhere?.close();
		await app.teardown();
	});

	it('reach a provider on a private host the operator allows', async () => {
		const callback = await signIn();

		assert.strictEqual(callback.pathname, '/auth/callback');
		assert.ok(callback.searchParams.get('code'), callback.search);
		assert.deepStrictEqual(requests, [ 'POST /token', 'GET /userinfo' ]);
	});

	it('never connect to the server\'s own host, even when the provider\'s name resolves there', async () => {
		app.set('oauthPrivateHosts', []);

		const callback = await signIn();

		assert.strictEqual(callback.searchParams.get('error'), refused);
		assert.strictEqual(provider.connections, 0);
	});

	it('do not follow a redirect, which could lead to an address that is never looked up', async () => {
		profileRedirect = `http://127.0.0.1:${elsewhere.port}/userinfo`;

		const callback = await signIn();

		assert.strictEqual(callback.searchParams.get('error'), refused);
		assert.deepStrictEqual(requests, [ 'POST /token', 'GET /userinfo' ]);
		assert.strictEqual(elsewhere.connections, 0);
	});
});
