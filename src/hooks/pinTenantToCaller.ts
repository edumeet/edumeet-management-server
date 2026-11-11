import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';

/**
 * Before hook for create and patch (use with iff(notSuperAdmin(), ...), after validateData):
 * write the row into the caller's own tenant, whatever tenantId the request sent. The
 * permission hooks only check the tenant a row is in now, so without this a tenant admin
 * could create a row in, or move one to, another tenant.
 */
export const pinTenantToCaller = (context: HookContext) => {
	const tenantId = context.params.user?.tenantId;

	if (tenantId === undefined || tenantId === null) throw new Forbidden('Not a member of a tenant');

	const pin = (data: Record<string, unknown>) => ({ ...data, tenantId });

	context.data = Array.isArray(context.data) ? context.data.map(pin) : pin(context.data ?? {});

	return context;
};
