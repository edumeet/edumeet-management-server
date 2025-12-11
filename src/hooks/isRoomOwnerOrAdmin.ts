import { HookContext } from '../declarations';

// Make a feathers hook that checks if the user is the owner of the room.
// It does this by checking the roomOwners service for a record with the roomId and userId.
// If the user is the owner, the hook returns the context.
// If the user is not the owner, the hook throws a Forbidden error.

export const isRoomOwnerOrAdmin = async (context: HookContext): Promise<void> => {
	// We only care about external calls
	if (!context.params.provider) return;

	const { user } = context.params;

	// TODO: Check properly if the user is an owner of the room
	let roomId: string | undefined;

	if (context.id)
		roomId = String(context.id);
	else if (context.data.roomId)
		roomId = context.data.roomId;

	if (!roomId)
		throw new Error('No room id provided');

	if (user?.tenantAdmin || user?.tenantOwner) {
		// is tenant admin but still might be from an other tenant
		const { tenantId } = await context.app.service('rooms').get(roomId);

		if (tenantId) {
			if (tenantId != parseInt(context.params.user.tenantId))
				throw new Error('You are not an owner of this room');	
		}
		
		return;
	} 

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

export const isRoomOwnerOrAdminRoomIdOfGroupRole = async (context: HookContext): Promise<void> => {
	// We only care about external calls
	if (!context.params.provider) return;

	const { user } = context.params;

	// TODO: Check properly if the user is an owner of the room
	let roomId: string | undefined;

	// grr id -> roomid 

	if (context.id) {

		const rgr = await context.app.service('roomGroupRoles').get(context.id);

		roomId = String(rgr.roomId);

	}

	if (!roomId)
		throw new Error('No room id provided');

	if (user?.tenantAdmin || user?.tenantOwner) {
		// is tenant admin but still might be from an other tenant
		const { tenantId } = await context.app.service('rooms').get(roomId);

		if (tenantId) {
			if (tenantId != parseInt(context.params.user.tenantId))
				throw new Error('You are not an owner of this room');	
		}
		
		return;
	} else {
		// If the user is not the owner of the room, throw an error.
		const { total } = await context.app.service('roomOwners').find({
			query: {
				roomId: parseInt(roomId),
				userId: context.params.user.id
			}
		});

		if (total === 0)
			throw new Error('You are not an owner of this room');
	}
};