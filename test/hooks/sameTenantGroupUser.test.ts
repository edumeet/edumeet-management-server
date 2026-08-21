import assert from 'assert';
import { groupAndUserInSameTenant } from '../../src/hooks/sameTenantGroupUser';

interface ContextOptions {
	groupTenantId?: number | string | null;
	userTenantId?: number | string | null;
	provider?: string;
	roles?: string[];
	data?: Record<string, unknown> | Record<string, unknown>[];
}

const makeContext = (options: ContextOptions = {}) => {
	const { provider, roles, data = { groupId: 7, userId: 5 } } = options;

	// Not destructured with defaults: passing an explicit undefined has to stay
	// undefined here, because that is one of the cases under test.
	const groupTenantId = 'groupTenantId' in options ? options.groupTenantId : 1;
	const userTenantId = 'userTenantId' in options ? options.userTenantId : 1;

	return {
		method: 'create',
		data,
		params: {
			provider,
			user: provider ? { id: 9, tenantId: 1, roles } : undefined
		},
		app: {
			service: (name: string) => {
				if (name === 'groups') return { get: async (id: number) => ({ id, tenantId: groupTenantId }) };
				if (name === 'users') return { get: async (id: number) => ({ id, tenantId: userTenantId }) };
				throw new Error(`unexpected service ${name}`);
			}
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
};

describe('groupAndUserInSameTenant hook', () => {
	it('allows a group and user of the same tenant', async () => {
		await assert.doesNotReject(groupAndUserInSameTenant(makeContext({ provider: 'rest' })));
	});

	it('rejects a cross-tenant assignment by a tenant admin', async () => {
		await assert.rejects(
			groupAndUserInSameTenant(makeContext({ provider: 'rest', groupTenantId: 2 })),
			/same tenant/
		);
	});

	it('rejects with a 403', async () => {
		await groupAndUserInSameTenant(makeContext({ provider: 'rest', groupTenantId: 2 })).then(
			() => assert.fail('expected the hook to reject'),
			(err) => assert.strictEqual(err.code, 403)
		);
	});

	it('exempts a super admin, who manages every tenant', async () => {
		await assert.doesNotReject(
			groupAndUserInSameTenant(makeContext({ provider: 'rest', roles: [ 'super-admin' ], groupTenantId: 2 }))
		);
	});

	it('still enforces on internal calls, which is the gainRules path', async () => {
		// notSuperAdmin() reports false for internal calls, so an iff() wrapper would
		// have exempted exactly the caller this guard exists for.
		await assert.rejects(
			groupAndUserInSameTenant(makeContext({ groupTenantId: 2 })),
			/same tenant/
		);
	});

	it('allows an internal same-tenant call', async () => {
		await assert.doesNotReject(groupAndUserInSameTenant(makeContext()));
	});

	it('compares ids across the string form bigint columns come back as', async () => {
		await assert.doesNotReject(
			groupAndUserInSameTenant(makeContext({ groupTenantId: '1', userTenantId: 1 }))
		);
	});

	it('leaves missing ids to the data validator', async () => {
		await assert.doesNotReject(groupAndUserInSameTenant(makeContext({ data: {} })));
	});

	it('checks every row of a bulk create, which would otherwise bypass it', async () => {
		await assert.rejects(
			groupAndUserInSameTenant(makeContext({
				groupTenantId: 2,
				data: [ { groupId: 7, userId: 5 }, { groupId: 8, userId: 6 } ]
			})),
			/same tenant/
		);
	});

	it('allows a bulk create where every row stays inside the tenant', async () => {
		await assert.doesNotReject(
			groupAndUserInSameTenant(makeContext({ data: [ { groupId: 7, userId: 5 }, { groupId: 8, userId: 6 } ] }))
		);
	});

	it('treats a null and an undefined tenant as the same absent tenant', async () => {
		await assert.doesNotReject(
			groupAndUserInSameTenant(makeContext({ groupTenantId: null, userTenantId: undefined }))
		);
	});

	it('does not let a tenantless user into a tenant group', async () => {
		await assert.rejects(
			groupAndUserInSameTenant(makeContext({ groupTenantId: 1, userTenantId: null })),
			/same tenant/
		);
	});

	it('accepts the number form mysql2 returns for a bigint', async () => {
		await assert.doesNotReject(
			groupAndUserInSameTenant(makeContext({ groupTenantId: 1, userTenantId: '1' }))
		);
	});
});
