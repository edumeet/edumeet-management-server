import assert from 'assert';
import { gainRules } from '../../src/hooks/gainRules';
import { logger } from '../../src/logger';

interface FakeRule {
	id?: number;
	name?: string;
	tenantId?: number;
	type?: string;
	parameter?: string;
	method?: string;
	negate?: boolean;
	value?: string;
	action?: string;
	accessId?: string | null;
}

const rule = (over: Partial<FakeRule> = {}): FakeRule => ({
	id: 1,
	name: 'test rule',
	tenantId: 1,
	type: 'gain',
	parameter: 'email',
	method: 'endswith',
	negate: false,
	value: '@example.com',
	action: 'groupUsers',
	accessId: '7',
	...over
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

class FakeCollection {
	rows: Row[] = [];
	failOnWrite = false;

	async find({ query }: { query: Row }) {
		return this.rows.filter((row) => Object.entries(query).every(([ key, value ]) => row[key] === value));
	}

	async create(data: Row) {
		if (this.failOnWrite) throw new Error('collection is unavailable');
		this.rows.push(data);

		return data;
	}

	async patch(id: number, data: Row) {
		if (this.failOnWrite) throw new Error('collection is unavailable');
		this.rows.push({ id, ...data });

		return data;
	}
}

interface ContextOptions {
	rules?: FakeRule[];
	data?: Row | undefined;
	result?: Row | Row[] | undefined;
	method?: string;
	client?: string;
}

const makeContext = (options: ContextOptions = {}) => {
	const {
		rules = [ rule() ],
		data = { tenantId: 1, email: 'someone@example.com' },
		result = { id: 5, roles: null },
		method = 'create',
		client = 'pg'
	} = options;

	const collections: Record<string, FakeCollection> = {
		groupUsers: new FakeCollection(),
		tenantOwners: new FakeCollection(),
		tenantAdmins: new FakeCollection(),
		users: new FakeCollection()
	};

	const context = {
		method,
		data,
		result,
		app: {
			get: (key: string) => (key === 'postgresql' ? { client } : undefined),
			service: (name: string) => {
				if (name === 'rules') return { find: async () => rules };
				if (collections[name]) return collections[name];
				throw new Error(`unexpected service ${name}`);
			}
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { context: context as any, collections };
};

describe('gainRules hook', () => {
	// Several cases deliberately trip warnings/errors; keep the mocha output readable.
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('adds a matching user to the group', async () => {
		const { context, collections } = makeContext();

		await gainRules(context);

		assert.deepStrictEqual(collections.groupUsers.rows, [ { groupId: 7, userId: 5 } ]);
	});

	it('is idempotent across repeated logins', async () => {
		const { context, collections } = makeContext();

		await gainRules(context);
		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 1);
	});

	it('runs on patch, which is what every subsequent SSO login performs', async () => {
		const { context, collections } = makeContext({ method: 'patch' });

		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 1);
	});

	it('does nothing when the user does not match', async () => {
		const { context, collections } = makeContext({ data: { tenantId: 1, email: 'someone@other.org' } });

		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});

	it('does nothing for methods other than create and patch', async () => {
		for (const method of [ 'find', 'get', 'remove' ]) {
			const { context, collections } = makeContext({ method });

			await gainRules(context);

			assert.strictEqual(collections.groupUsers.rows.length, 0, `${method} must not grant anything`);
		}
	});

	it('does nothing for a multi-patch, where there is no single subject', async () => {
		const { context, collections } = makeContext({ method: 'patch', result: [ { id: 5 }, { id: 6 } ] });

		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});

	it('does nothing when the data carries no tenantId', async () => {
		const { context, collections } = makeContext({ data: { email: 'someone@example.com' } });

		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});

	it('logs and continues when a grant fails, so the login still succeeds', async () => {
		const { context, collections } = makeContext();

		collections.groupUsers.failOnWrite = true;

		await assert.doesNotReject(gainRules(context));
		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});

	it('keeps applying later rules after an earlier one fails', async () => {
		const { context, collections } = makeContext({
			rules: [ rule({ id: 1 }), rule({ id: 2, action: 'tenantAdmins' }) ]
		});

		collections.groupUsers.failOnWrite = true;

		await assert.doesNotReject(gainRules(context));
		assert.deepStrictEqual(collections.tenantAdmins.rows, [ { tenantId: 1, userId: 5 } ]);
	});

	it('grants tenant owner and tenant admin', async () => {
		for (const action of [ 'tenantOwners', 'tenantAdmins' ] as const) {
			const { context, collections } = makeContext({ rules: [ rule({ action }) ] });

			await gainRules(context);

			assert.deepStrictEqual(collections[action].rows, [ { tenantId: 1, userId: 5 } ]);
		}
	});

	it('promotes to super-admin only when the user is not one already', async () => {
		const { context, collections } = makeContext({ rules: [ rule({ action: 'superAdmin' }) ] });

		await gainRules(context);
		assert.deepStrictEqual(collections.users.rows, [ { id: 5, roles: [ 'super-admin' ] } ]);

		const already = makeContext({
			rules: [ rule({ action: 'superAdmin' }) ],
			result: { id: 5, roles: [ 'super-admin' ] }
		});

		await gainRules(already.context);
		assert.strictEqual(already.collections.users.rows.length, 0);
	});

	it('does not grant a group when accessId is unusable', async () => {
		for (const accessId of [ null, '', 'not-a-number' ]) {
			const { context, collections } = makeContext({ rules: [ rule({ accessId }) ] });

			await assert.doesNotReject(gainRules(context));
			assert.strictEqual(collections.groupUsers.rows.length, 0, `accessId ${accessId} must not grant`);
		}
	});

	it('skips an unevaluatable rule instead of letting negate match everybody', async () => {
		const { context, collections } = makeContext({ rules: [ rule({ parameter: 'emial', negate: true }) ] });

		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});

	it('ignores rules of another type', async () => {
		const { context, collections } = makeContext({ rules: [ rule({ type: 'block' }), rule({ type: 'allow' }), rule({ type: 'Gain' }) ] });

		await gainRules(context);

		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});

	it('does nothing for an unknown action', async () => {
		const { context, collections } = makeContext({ rules: [ rule({ action: 'makeCoffee' }) ] });

		await assert.doesNotReject(gainRules(context));
		assert.strictEqual(collections.groupUsers.rows.length, 0);
	});
});
