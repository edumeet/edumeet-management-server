import { HookContext } from '../declarations';

export const notTenantManager = () => (context: HookContext) => {
	if (!context.params.user) return true;

	return !context.params.user.tenantAdmin || !context.params.user.tenantOwner;
};