import { HookContext } from '../declarations';

// Make a feathers hook that checks if the user is the owner of the room.
// It does this by checking the roomOwners service for a record with the roomId and userId.
// If the user is the owner, the hook returns the context.
// If the user is not the owner, the hook throws a Forbidden error.

export const isRoomOwnerOrAdmin = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (!context.params.user)
		throw new Error('You are not logged in');

	if (context.params.user.tenantAdmin || context.params.user.tenantOwner)
		return;

	let roomId: string | undefined;

	if (context.id)
		roomId = String(context.id);
	else if (context.data)
		roomId = context.data.roomId;

	if (!roomId)
		throw new Error('No room id provided');

	// If the user is not the owner of the room, throw an error.
	const { total } = await context.app.service('roomOwners').find({
		query: {
			roomId: parseInt(roomId),
			userId: context.params.user.id
		}
	});

	if (total === 0)
		throw new Error('You are not an owner of this room');
};