import { HookContext } from '../declarations';

export const addRoomOwner = async (context: HookContext): Promise<void> => {
	// We only care about external calls
	if (!context.params.provider) return;

	await context.app.service('roomOwners').create({
		roomId: parseInt(context.result.id),
		userId: parseInt(context.params.user.id)
	});
};