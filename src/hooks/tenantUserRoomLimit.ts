import { HookContext } from '../declarations';

export const tenantRoomLimit = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (context.params.provider && !context.params.user)
		throw new Error('You are not logged in');
    
	// when creating check if user has less rooms than the limit
	const defaultsService = context.app.service('defaults');
	const roomsService = context.app.service('rooms');

	const limit = await defaultsService.find({
		paginate: false, // Fetch all relevant records
		query: {
			tenantId: parseInt(context.params.user.tenantId),
		}
	});
	
	const rooms = await roomsService.find({
		query: {
			$limit: 0,
			tenantId: parseInt(context.params.user.tenantId),
		}
	});

	if (limit && rooms) {
		limit.forEach((element) => {
			if (element && element.numberLimit)
				if (element.numberLimit < rooms.total)
					throw new Error('Room limit reached!');	
		});
		
	}

};