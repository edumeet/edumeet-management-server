import assert from 'assert';
import { scopeToTenantByParent } from '../../src/hooks/scopeToTenantByParent';
import { notSuperAdmin } from '../../src/hooks/notSuperAdmin';

interface ContextOptions {
	method?: 'find' | 'get';
	id?: number;
	provider?: string;
	roles?: string[];
	tenantId?: number | null;
	query?: Record<string, unknown>;

	/** ids the parent service returns for the caller's tenant */
	parentIds?: unknown[];
}

const makeContext = (options: ContextOptions = {}) => {
	const { method = 'find', id, roles, query, parentIds = [ 1, 2 ] } = options;

	// What the parent service was asked for, so a test can assert on it.
	const parentFinds: Record<string, unknown>[] = [];

	// Not destructured with defaults: passing an explicit undefined has to stay
	// undefined here, because that is one of the cases under test.
	const provider = 'provider' in options ? options.provider : 'rest';
	const tenantId = 'tenantId' in options ? options.tenantId : 1;

	return {
		parentFinds,
		method,
		id,
		params: {
			provider,
			query,
			user: provider ? { id: 9, tenantId, roles } : undefined
		},
		app: {
			service: (name: string) => {
				if (name === 'groups' || name === 'rooms' || name === 'roles') {
					return {
						find: async (params: Record<string, unknown>) => {
							parentFinds.push(params);

							return parentIds.map((parentId) => ({ id: parentId }));
						}
					};
				}
				throw new Error(`unexpected service ${name}`);
			}
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
};

const scopeGroups = scopeToTenantByParent({ key: 'groupId', parentService: 'groups' });

describe('scopeToTenantByParent hook', () => {
	it('constrains a bare find to the tenant\'s own parent rows', async () => {
		const context = makeContext();

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $in: [ 1, 2 ] } });
		assert.strictEqual(context.result, undefined);
	});

	it('leaves the rest of the query alone', async () => {
		const context = makeContext({ query: { $limit: 9999, $sort: { id: 1 } } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, {
			$limit: 9999,
			$sort: { id: 1 },
			groupId: { $in: [ 1, 2 ] }
		});
	});

	it('keeps a parent id the caller owns', async () => {
		const context = makeContext({ query: { groupId: 2 } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: 2 });
	});

	it('returns nothing for a parent id of another tenant', async () => {
		const context = makeContext({ query: { groupId: 77 } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $in: [] } });
	});

	it('intersects a caller supplied $in instead of trusting it', async () => {
		// The check this replaces was `typeof value === 'number'`, so an $in went
		// through unvalidated and pulled in another tenant's rows.
		const context = makeContext({ query: { groupId: { $in: [ 2, 77 ] } } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $in: [ 2 ] } });
	});

	it('keeps the caller\'s other operators while adding its own', async () => {
		const context = makeContext({ query: { groupId: { $ne: 1 } } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $ne: 1, $in: [ 1, 2 ] } });
	});

	it('returns nothing when a caller supplied $in is entirely out of tenant', async () => {
		const context = makeContext({ query: { groupId: { $in: [ 77, 88 ] } } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $in: [] } });
	});

	it('returns nothing when the tenant has no parent rows at all', async () => {
		const context = makeContext({ parentIds: [] });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $in: [] } });
	});

	// Regression: the hook used to short-circuit with a hand-built
	// `{ total: 0, data: [], limit: 0, skip: 0 }`. That is the WRONG shape for
	// `roomGroupRoles`, which is registered `paginate: false` and returns a bare
	// array, so the Group Roles table crashed on `[ ...(data ?? []) ]`.
	it('never sets a result itself, so each service keeps its own result shape', async () => {
		for (const query of [ undefined, { groupId: 77 }, { groupId: { $in: [ 77 ] } } ]) {
			const context = makeContext({ query, parentIds: [] });

			await scopeGroups(context);

			assert.strictEqual(context.result, undefined, `result was set for query ${JSON.stringify(query)}`);
		}
	});

	it('matches ids across the bigint string/number split', async () => {
		// node-postgres returns bigint as a string, mysql2 as a number.
		const context = makeContext({ parentIds: [ '2' ], query: { groupId: 2 } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: 2 });
	});

	it('reduces the parent lookup to ids so room virtuals are not resolved', async () => {
		const context = makeContext();

		await scopeGroups(context);

		assert.strictEqual(context.parentFinds.length, 1);
		assert.deepStrictEqual(context.parentFinds[0].query, { tenantId: 1, $select: [ 'id' ] });
		assert.strictEqual(context.parentFinds[0].paginate, false);
		assert.strictEqual(context.parentFinds[0].provider, undefined);
	});

	// `get` needs no special case: the knex adapter merges `params.query` into its
	// lookup and raises NotFound itself when nothing matches.
	it('constrains a get the same way, leaving NotFound to the adapter', async () => {
		const context = makeContext({ method: 'get', id: 5, query: { groupId: 77 } });

		await scopeGroups(context);

		assert.deepStrictEqual(context.params.query, { groupId: { $in: [] } });
		assert.strictEqual(context.result, undefined);
	});

	it('refuses a caller with no tenant rather than falling open', async () => {
		const context = makeContext({ tenantId: null });

		await assert.rejects(scopeGroups(context), /Not allowed/);
	});

	// The hook is only ever wired as `iff(notSuperAdmin(), ...)`. These two pin
	// that contract, because dropping the guard would filter the room server's
	// own reads and empty out every room it fetches.
	describe('callers the service level iff() must keep exempt', () => {
		it('skips an internal call, which has no user to scope by', () => {
			const context = makeContext({ provider: undefined });

			assert.strictEqual(notSuperAdmin()(context), false);
		});

		it('skips a super-admin', () => {
			const context = makeContext({ roles: [ 'super-admin' ] });

			assert.strictEqual(notSuperAdmin()(context), false);
		});

		it('skips the edumeet-server account the room servers log in with', () => {
			const context = makeContext({ roles: [ 'edumeet-server' ] });

			assert.strictEqual(notSuperAdmin()(context), false);
		});

		it('applies to a tenant admin', () => {
			const context = makeContext({ roles: [ 'tenant-admin' ] });

			assert.strictEqual(notSuperAdmin()(context), true);
		});
	});
});
