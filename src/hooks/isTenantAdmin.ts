import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';

export const isTenantAdmin = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (context.params.provider && !context.params.user)
		throw new Error('You are not logged in');

	if (context.params.user && !(context.params.user.tenantAdmin || context.params.user.tenantOwner))
		throw new Error('Not a tenant admin');
};

export const checkTenantAdminOrGroupMemberOnDelete = async (context: HookContext): Promise<void> => {

	// If the user is not logged in, throw an error.
	if (context.params.provider && !context.params.user)
		throw new Error('You are not logged in');

	const id = context.id;

	if (id === undefined || id === null) throw new Forbidden('Remove one membership at a time');

	const { groupId, userId } = await context.app.service('groupUsers').get(id);
	const { tenantId } = await context.app.service('groups').get(groupId);

	if (String(tenantId) === String(context.params.user.tenantId) && (context.params.user.tenantAdmin || context.params.user.tenantOwner)) {
		// tenant admin in the same tenant
		return;
	}

	// anyone else may only leave a group themselves
	if (String(userId) !== String(context.params.user.id))
		throw new Forbidden('You can only remove your own membership');

};
