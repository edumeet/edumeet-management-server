import { HookContext } from '../declarations';

// Make a feathers hook that checks if the user is the owner of the room.
// It does this by checking the roomOwners service for a record with the roomId and userId.
// If the user is the owner, the hook returns the context.
// If the user is not the owner, the hook throws a Forbidden error.

export const isInSameTenantAndTenantOwnerOrAdmin = async (context: HookContext): Promise<void> => {
	// We only care about external calls
	if (!context.params.provider) return;

	const { user } = context.params;

	if (!user?.tenantAdmin && !user?.tenantOwner) 
		throw new Error('You are not a tenant owner or admin');

	// TODO: Check properly if the user is an owner of the room
	let tenantId: string | undefined;

	if (context.id)
		tenantId = String(context.id);

	if (!tenantId)
		throw new Error('No tenantId provided');

	// If the user is not the owner of the tenant, throw an error.
	const o = await context.app.service('tenantOwners').find({
		query: {
			tenantId: parseInt(tenantId),
			userId: context.params.user.id
		}
	});

	// If the user is not the admin of the tenant, throw an error.
	const a = await context.app.service('tenantAdmins').find({
		query: {
			tenantId: parseInt(tenantId),
			userId: context.params.user.id
		}
	});

	if (o.total === 0 && a.total === 0)
		throw new Error('You are not an owner or admin of this tenant');
};