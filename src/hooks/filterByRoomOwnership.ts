import { HookContext } from '@feathersjs/feathers';

const filterByRoomOwnership = async (context: HookContext): Promise<void> => {
	const { app, params } = context;

	// Ensure we have an authenticated user
	const userId = params.user?.id;

	if (!userId) {
		throw new Error('User is not authenticated.');
	}
	if (!context.params.user.tenantAdmin && !context.params.user.tenantOwner) {
		// Get the roomOwners service
		const roomOwnersService = app.service('roomOwners');

		// Query roomOwners to get room IDs for the current user
		const roomOwners = await roomOwnersService.find({
			paginate: false, // Fetch all relevant records
			query: {
				userId // Filter by the authenticated user's ID
			}
		});

		if (roomOwners) {
		// Extract the list of room IDs
			const validRoomIds: string[] = roomOwners.map((owner: any) => owner.roomId);

			// If no valid room IDs are found, return an empty result
			if (validRoomIds.length === 0) {
				context.result = { total: 0, data: [], limit: 0, skip: 0 };
			}

			// Modify the query to filter rooms by the valid room IDs
			context.params.query = {
				...params.query,
				id: { $in: validRoomIds } // FeathersJS query operator for "in" array
			};

		}
	}

};

export default filterByRoomOwnership;