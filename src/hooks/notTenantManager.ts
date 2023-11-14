import { HookContext } from '../declarations';

export const notTenantManager = () => (context: HookContext) => {
	if (!context.params.user) return true;
    
	// Not tenant admin and not owner 
	return !context.params.user.tenantAdmin && !context.params.user.tenantOwner;
};