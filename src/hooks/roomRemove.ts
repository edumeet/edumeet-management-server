import { HookContext, NextFunction } from '../declarations';
import { Room } from '../services/rooms/rooms.schema';

export const roomRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed room
	const { id } = context.result as Room;

	// Remove all group roles for this room
	const groupRoles = await context.app.service('roomGroupRoles').find({
		query: {
			roomId: id
		}
	});

	await Promise.all(groupRoles.data.map((groupRole) => context.app.service('roomGroupRoles').remove(groupRole.id)));

	// Remove all user roles for this room
	const userRoles = await context.app.service('roomUserRoles').find({
		query: {
			roomId: id
		}
	});

	await Promise.all(userRoles.data.map((userRole) => context.app.service('roomUserRoles').remove(userRole.id)));
};