import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';

/**
 * Before hook for create and patch (use with iff(notSuperAdmin(), ...), after validateData):
 * a userId in the request must belong to the caller's own tenant. Pair it with
 * pinTenantToCaller, which pins the row's tenantId; without this check a row in the own
 * tenant could still point at a user of another tenant.
 */
export const userInCallerTenant = async (context: HookContext) => {
	const tenantId = context.params.user?.tenantId;

	if (tenantId === undefined || tenantId === null) throw new Forbidden('Not a member of a tenant');

	const rows: Array<Record<string, unknown>> = Array.isArray(context.data) ? context.data : [ context.data ?? {} ];

	for (const row of rows) {
		if (row.userId === undefined || row.userId === null) continue;

		const user = await context.app.service('users').get(Number(row.userId), { provider: undefined, query: {} })
			.catch(() => undefined);

		if (!user || String(user.tenantId) !== String(tenantId))
			throw new Forbidden('The user must belong to your tenant');
	}

	return context;
};
