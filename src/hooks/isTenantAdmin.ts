import { HookContext } from '../declarations';

export const isTenantAdmin = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (!context.params.user)
		throw new Error('You are not logged in');

	if (context.params.user.tenantAdmin || context.params.user.tenantOwner)
		return;

	throw new Error('Not a tenant admin');
};