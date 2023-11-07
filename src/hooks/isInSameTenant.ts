import { HookContext } from '../declarations';

// Make a feathers hook that checks if the user is the owner of the room.
// It does this by checking the roomOwners service for a record with the roomId and userId.
// If the user is the owner, the hook returns the context.
// If the user is not the owner, the hook throws a Forbidden error.

export const isInSameTenant = () => (context: HookContext) => {

	// You can not move roles to a different tenant
	return (context.params.tenantId === context.params.user.tenantId);

};