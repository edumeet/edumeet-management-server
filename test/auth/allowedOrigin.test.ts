import assert from 'assert';
import { NotAuthenticated } from '@feathersjs/errors';
import { resolveAllowedOrigin } from '../../src/auth/allowedOrigin';

const FQDNS = [
	{ id: 1, fqdn: 'rooms.acme.edu', tenantId: 1 },
	{ id: 2, fqdn: 'Meet.Acme.Edu', tenantId: 1 },
	{ id: 3, fqdn: 'localhost:8443', tenantId: 1 },
	{ id: 4, fqdn: 'rooms.other.org', tenantId: 2 },
	{ id: 5, fqdn: 'conf.acme.edu:8443', tenantId: 1 },
	{ id: 6, fqdn: 'localhost', tenantId: 3 },
	{ id: 7, fqdn: '127.0.0.1', tenantId: 3 },
	{ id: 8, fqdn: '[::1]', tenantId: 3 },
	{ id: 9, fqdn: 'localhost.acme.edu', tenantId: 3 },
	{ id: 10, fqdn: '127.0.0.1.acme.edu', tenantId: 3 }
];

const makeApp = (paginated = false) => {
	const queries: Record<string, unknown>[] = [];
	const app = {
		service: (name: string) => {
			assert.strictEqual(name, 'tenantFQDNs');

			return {
				find: async ({ query }: { query: { tenantId: number } }) => {
					queries.push(query);

					const rows = FQDNS.filter((row) => row.tenantId === query.tenantId);

					return paginated ? { total: rows.length, data: rows } : rows;
				}
			};
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { app, queries };
};

const refused = async (promise: Promise<unknown>) => {
	await assert.rejects(promise, (error: Error) => error instanceof NotAuthenticated);
};

describe('resolveAllowedOrigin', () => {
	it('accepts an origin whose host is registered for the tenant', async () => {
		const { app, queries } = makeApp();

		assert.strictEqual(await resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu'), 'https://rooms.acme.edu');
		assert.deepStrictEqual(queries, [ { tenantId: 1 } ]);
	});

	it('compares registered names case-insensitively', async () => {
		const { app } = makeApp();

		assert.strictEqual(await resolveAllowedOrigin(app, 1, 'https://meet.acme.edu'), 'https://meet.acme.edu');
	});

	it('accepts a registered name that carries a port', async () => {
		const { app } = makeApp();

		assert.strictEqual(await resolveAllowedOrigin(app, 1, 'https://localhost:8443'), 'https://localhost:8443');
	});

	it('works when the service returns a paginated result', async () => {
		const { app } = makeApp(true);

		assert.strictEqual(await resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu'), 'https://rooms.acme.edu');
	});

	it('refuses a missing origin', async () => {
		const { app, queries } = makeApp();

		await refused(resolveAllowedOrigin(app, 1, undefined));
		await refused(resolveAllowedOrigin(app, 1, ''));
		await refused(resolveAllowedOrigin(app, 1, [ 'https://rooms.acme.edu' ]));
		assert.strictEqual(queries.length, 0);
	});

	it('refuses a host registered for another tenant', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, 1, 'https://rooms.other.org'));
	});

	it('refuses an unregistered host', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, 1, 'https://evil.example'));
		await refused(resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu.evil.example'));
	});

	it('refuses anything that is not a bare http or https origin', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, 1, 'javascript:alert(1)'));
		await refused(resolveAllowedOrigin(app, 1, 'ftp://rooms.acme.edu'));
		await refused(resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu/'));
		await refused(resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu/join'));
		await refused(resolveAllowedOrigin(app, 1, 'https://user@rooms.acme.edu'));
		await refused(resolveAllowedOrigin(app, 1, 'https://ROOMS.acme.edu'));
		await refused(resolveAllowedOrigin(app, 1, 'not a url'));
		await refused(resolveAllowedOrigin(app, 1, 'null'));
	});

	// A page loaded over plain http can be replaced by anyone between the browser and the
	// server, and it would receive the token.
	it('refuses a plain http origin of a registered host', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, 1, 'http://rooms.acme.edu'));
		await refused(resolveAllowedOrigin(app, 1, 'http://meet.acme.edu'));
		await refused(resolveAllowedOrigin(app, 1, 'http://conf.acme.edu:8443'));
		await refused(resolveAllowedOrigin(app, 1, 'http://rooms.acme.edu:443'));
	});

	// Another port of the same host is another service, maybe run by someone else.
	it('refuses another port of a registered host', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu:8443'));
		await refused(resolveAllowedOrigin(app, 1, 'https://rooms.acme.edu:444'));
		await refused(resolveAllowedOrigin(app, 1, 'https://meet.acme.edu:4443'));
	});

	it('accepts a name registered with a port on that port only', async () => {
		const { app } = makeApp();

		assert.strictEqual(await resolveAllowedOrigin(app, 1, 'https://conf.acme.edu:8443'), 'https://conf.acme.edu:8443');
		await refused(resolveAllowedOrigin(app, 1, 'https://conf.acme.edu'));
		await refused(resolveAllowedOrigin(app, 1, 'https://conf.acme.edu:9443'));
	});

	it('accepts http and any port on this computer, for development', async () => {
		const { app } = makeApp();

		for (const origin of [
			'http://localhost',
			'http://localhost:5173',
			'https://localhost:4443',
			'http://127.0.0.1:3000',
			'https://127.0.0.1',
			'http://[::1]:3000'
		]) assert.strictEqual(await resolveAllowedOrigin(app, 3, origin), origin);

		assert.strictEqual(await resolveAllowedOrigin(app, 1, 'http://localhost:8443'), 'http://localhost:8443');
	});

	it('still wants this computer\'s name to be registered for the tenant', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, 2, 'http://localhost:5173'));
		await refused(resolveAllowedOrigin(app, 1, 'http://localhost:5173'));
		await refused(resolveAllowedOrigin(app, 1, 'https://localhost'));
	});

	it('does not take a name that only starts like this computer\'s for it', async () => {
		const { app } = makeApp();

		assert.strictEqual(await resolveAllowedOrigin(app, 3, 'https://localhost.acme.edu'), 'https://localhost.acme.edu');
		await refused(resolveAllowedOrigin(app, 3, 'http://localhost.acme.edu'));
		await refused(resolveAllowedOrigin(app, 3, 'https://localhost.acme.edu:8443'));
		await refused(resolveAllowedOrigin(app, 3, 'http://127.0.0.1.acme.edu'));
		await refused(resolveAllowedOrigin(app, 3, 'https://127.0.0.1.acme.edu:8443'));
	});

	it('refuses an invalid tenant id', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, NaN, 'https://rooms.acme.edu'));
	});
});
