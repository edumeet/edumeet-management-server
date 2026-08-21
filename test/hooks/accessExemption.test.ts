import assert from 'assert';
import { isAccessPermitted, isExemptFromAccessRules } from '../../src/hooks/accessDecision';
import { logger } from '../../src/logger';

/**
 * Administrators must never be locked out by an access rule, because the rules are
 * edited through the interface they would lose access to.
 */

interface Options {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	rules?: any[];
	admins?: { tenantId: number; userId: number }[];
	owners?: { tenantId: number; userId: number }[];
}

// an allow list that nothing matches, closed with the catch-all
const SHUT_OUT = [
	{
		id: 1,
		name: 'only acme',
		tenantId: 1,
		type: 'allow',
		parameter: 'email',
		method: 'endswith',
		value: '@acme.edu',
		negate: false
	},
	{
		id: 2,
		name: 'everyone else',
		tenantId: 1,
		type: 'block',
		parameter: '',
		method: 'anyone',
		value: '',
		negate: false
	}
];

const makeApp = (options: Options = {}) => {
	const { rules = SHUT_OUT, admins = [], owners = [] } = options;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const table = (rows: any[]) => ({
		find: async ({ query }: { query: Record<string, unknown> }) =>
			rows.filter((row) => Object.entries(query).every(([ k, v ]) => row[k] === v))
	});

	return {
		service: (name: string) => {
			if (name === 'rules') return { find: async () => rules };
			if (name === 'tenantAdmins') return table(admins);
			if (name === 'tenantOwners') return table(owners);
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
};

const OUTSIDER = { email: 'someone@elsewhere.org' };

describe('administrators are exempt from access rules', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('a tenant with no rules admits everyone and touches no other service', async () => {
		// the majority of deployments. Nothing may change for them, and the decision
		// must cost exactly one lookup.
		let services: string[] = [];
		const app = makeApp({ rules: [] });
		const inner = app.service;

		app.service = (name: string) => {
			services.push(name);

			return inner(name);
		};

		assert.strictEqual(await isAccessPermitted(app, 1, OUTSIDER, 't'), true);
		assert.deepStrictEqual(services, [ 'rules' ], 'only the rules lookup should run');

		services = [];
		assert.strictEqual(await isAccessPermitted(app, 1, { email: 'anyone@anywhere.com' }, 't', { id: 9 }), true);
		assert.deepStrictEqual(services, [ 'rules' ]);
	});

	it('refuses an ordinary user the rules do not admit', async () => {
		const permitted = await isAccessPermitted(makeApp(), 1, OUTSIDER, 't', { id: 5, roles: [] });

		assert.strictEqual(permitted, false);
	});

	it('lets a super admin through a rule that would refuse them', async () => {
		const permitted = await isAccessPermitted(makeApp(), 1, OUTSIDER, 't', { id: 5, roles: [ 'super-admin' ] });

		assert.strictEqual(permitted, true);
	});

	it('lets a tenant admin of that tenant through', async () => {
		const app = makeApp({ admins: [ { tenantId: 1, userId: 5 } ] });

		assert.strictEqual(await isAccessPermitted(app, 1, OUTSIDER, 't', { id: 5, roles: [] }), true);
	});

	it('lets a tenant owner of that tenant through', async () => {
		const app = makeApp({ owners: [ { tenantId: 1, userId: 5 } ] });

		assert.strictEqual(await isAccessPermitted(app, 1, OUTSIDER, 't', { id: 5, roles: [] }), true);
	});

	it('does NOT exempt an admin of a different tenant', async () => {
		const app = makeApp({ admins: [ { tenantId: 99, userId: 5 } ] });

		assert.strictEqual(await isAccessPermitted(app, 1, OUTSIDER, 't', { id: 5, roles: [] }), false);
	});

	it('does not exempt a brand new account, which has no user record yet', async () => {
		assert.strictEqual(await isAccessPermitted(makeApp(), 1, OUTSIDER, 't', undefined), false);
	});

	it('reads the roles column in every shape the drivers return', async () => {
		const app = makeApp();

		// Postgres VARCHAR[] and MySQL json both surface as an array
		assert.strictEqual(await isExemptFromAccessRules(app, { id: 5, roles: [ 'super-admin' ] }, 1), true);
		// and it has been seen as a JSON string
		assert.strictEqual(await isExemptFromAccessRules(app, { id: 5, roles: '["super-admin"]' }, 1), true);
		// the service account role counts too
		assert.strictEqual(await isExemptFromAccessRules(app, { id: 5, roles: [ 'edumeet-server' ] }, 1), true);
		// and an ordinary user does not
		assert.strictEqual(await isExemptFromAccessRules(app, { id: 5, roles: [ 'user' ] }, 1), false);
		assert.strictEqual(await isExemptFromAccessRules(app, { id: 5, roles: null }, 1), false);
	});

	it('does not look up administrators when the rules already admit the user', async () => {
		// the lookup costs two queries, so it must only run for a refusal
		let looked = false;
		const app = makeApp();
		const inner = app.service;

		app.service = (name: string) => {
			if (name !== 'rules') looked = true;

			return inner(name);
		};

		assert.strictEqual(await isAccessPermitted(app, 1, { email: 'alice@acme.edu' }, 't', { id: 5 }), true);
		assert.strictEqual(looked, false, 'admin tables must not be queried for a permitted user');
	});
});
