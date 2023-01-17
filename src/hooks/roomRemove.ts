import { HookContext, NextFunction } from '../declarations';
import { Room } from '../services/rooms/rooms.schema';

export const roomRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed room
	const { id } = context.result as Room;

	// Remove all coHost relations
	const coHosts = await context.app.service('coHosts').find({
		query: {
			roomId: id
		}
	});

	await Promise.all(coHosts.data.map((coHost) => context.app.service('coHosts').remove(coHost.id)));
};