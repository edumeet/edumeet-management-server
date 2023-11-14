import { HookContext } from '../declarations';

// Make a feathers hook that checks if the user is the owner of the room.
// It does this by checking the roomOwners service for a record with the roomId and userId.
// If the user is the owner, the hook returns the context.
// If the user is not the owner, the hook throws a Forbidden error.

export const notInSameTenant = (context: HookContext) => {

	if (context.data.tenantId != context.params.user.tenantId)
		throw new Error('You are not in the same tenant');
};