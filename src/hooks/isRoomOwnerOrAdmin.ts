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

export const isRoomOwnerOrAdminRoomIdOfUserRole = async (context: HookContext): Promise<void> => {
	// We only care about external calls
	if (!context.params.provider) return;

	const { user } = context.params;

	let roomId: string | undefined;

	// 1) create/patch (if roomId included)
	if (context.data?.roomId) roomId = String(context.data.roomId);

	// 2) find (roomId comes from query)
	else if ((context.params)?.query?.roomId) roomId = String((context.params).query.roomId);

	// 3) get/patch/remove by id -> load record to get its roomId
	else if (context.id) {
		const rur = await context.app.service('roomUserRoles').get(context.id, {
			...context.params,
			provider: undefined, // internal call
			query: {}
		});

		roomId = String(rur.roomId);
	}

	if (!roomId) throw new Error('No room id provided');

	// same logic as your existing isRoomOwnerOrAdmin:
	if (user?.tenantAdmin || user?.tenantOwner) {
		const { tenantId } = await context.app.service('rooms').get(roomId);

		if (tenantId) {
			if (tenantId != parseInt(context.params.user.tenantId))
				throw new Error('You are not an owner of this room');
		}

		return;
	}

	const { total } = await context.app.service('roomOwners').find({
		query: {
			roomId: parseInt(roomId),
			userId: context.params.user.id
		}
	});

	if (total === 0) throw new Error('You are not an owner of this room');
};
