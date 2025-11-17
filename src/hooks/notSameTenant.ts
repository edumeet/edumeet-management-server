import { HookContext } from '../declarations';

export const notInSameTenant = (context: HookContext) => {
	if (parseInt(context.data.tenantId) !== parseInt(context.params.user.tenantId))
		throw new Error('You are not in the same tenant');
};
export const notInSameTenantByContextId = (context: HookContext) => {
	if (parseInt(context.data.tenantId) !== parseInt(context.params.user.tenantId))
		throw new Error('You are not in the same tenant');
};
