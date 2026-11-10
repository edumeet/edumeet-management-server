import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';
import { strictId } from './strictId';

const SERVICE_OF = {
	userId: 'users',
	roleId: 'roles',
	defaultRoleId: 'roles',
	groupId: 'groups',
} as const;

type ReferenceKey = keyof typeof SERVICE_OF;

/**
 * Before hook for create and patch (use with iff(notSuperAdmin(), ...), after validateData):
 * the users, roles and groups a row refers to must belong to the caller's own tenant. The
 * permission hooks check the room the row is for, not what it points at, so without this
 * a room owner could give a role of another tenant, or a group or user of another tenant
 * a role in their room.
 */
export const referencesInCallerTenant = (keys: ReferenceKey[]) => async (context: HookContext) => {
	const tenantId = context.params.user?.tenantId;

	if (tenantId === undefined || tenantId === null) throw new Forbidden('Not a member of a tenant');

	const rows: Array<Record<string, unknown>> = Array.isArray(context.data) ? context.data : [ context.data ?? {} ];

	for (const row of rows) {
		for (const key of keys) {
			const id = row[key];

			// The admin forms send 0 or '' when nothing is chosen; the database decides about those.
			if (id === undefined || id === null || id === 0 || id === '') continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const target = await (context.app.service(SERVICE_OF[key]) as any).get(strictId(id, key), { provider: undefined, query: {} })
				.catch(() => undefined);

			if (!target || String(target.tenantId) !== String(tenantId))
				throw new Forbidden(`${key} must belong to your tenant`);
		}
	}

	return context;
};
