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

	if (id) {
		const { groupId } = await context.app.service('groupUsers').get(id);
		const { tenantId } = await context.app.service('groups').get(groupId);

		if (tenantId == parseInt(context.params.user.tenantId) && (context.params.user.tenantAdmin || context.params.user.tenantOwner)) {
			// tenant admin in the same tenant 
			return;
		}
		const { total } = await context.app.service('groupUsers').find({
			query: {
				groupId: groupId,
				userId: context.params.user.id
			}
		});

		if (total === 0)
			throw new Error('You are not part of this group!');
	}

};
