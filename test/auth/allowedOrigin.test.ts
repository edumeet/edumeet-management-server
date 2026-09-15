import assert from 'assert';
import { NotAuthenticated } from '@feathersjs/errors';
import { resolveAllowedOrigin } from '../../src/auth/allowedOrigin';

const FQDNS = [
	{ id: 1, fqdn: 'rooms.acme.edu', tenantId: 1 },
	{ id: 2, fqdn: 'Meet.Acme.Edu', tenantId: 1 },
	{ id: 3, fqdn: 'localhost:8443', tenantId: 1 },
	{ id: 4, fqdn: 'rooms.other.org', tenantId: 2 }
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

	it('refuses an invalid tenant id', async () => {
		const { app } = makeApp();

		await refused(resolveAllowedOrigin(app, NaN, 'https://rooms.acme.edu'));
	});
});
