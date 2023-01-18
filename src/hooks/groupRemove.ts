import { HookContext, NextFunction } from '../declarations';
import { Group } from '../services/groups/groups.schema';

export const groupRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed group
	const { id } = context.result as Group;

	// Remove all users relations
	const groupUsers = await context.app.service('groupUsers').find({
		query: {
			groupId: id
		}
	});

	await Promise.all(groupUsers.data.map((groupUser) => context.app.service('groupUsers').remove(groupUser.id)));

	// Remove all room group role relations
	const roomGroupRoles = await context.app.service('roomGroupRoles').find({
		query: {
			groupId: id
		}
	});

	await Promise.all(roomGroupRoles.data.map((roomGroupRole) => context.app.service('roomGroupRoles').remove(roomGroupRole.id)));
};