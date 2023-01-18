import { HookContext, NextFunction } from '../declarations';
import { User } from '../services/users/users.schema';

export const userRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed user
	const { id } = context.result as User;

	// Remove all group relations
	const groupUsers = await context.app.service('groupUsers').find({
		query: {
			userId: id
		}
	});

	await Promise.all(groupUsers.data.map((groupUser) => context.app.service('groupUsers').remove(groupUser.id)));

	// Remove all room user role relations
	const roomUserRoles = await context.app.service('roomUserRoles').find({
		query: {
			userId: id
		}
	});

	await Promise.all(roomUserRoles.data.map((roomUserRole) => context.app.service('roomUserRoles').remove(roomUserRole.id)));

	// Remove all personal rooms
	const rooms = await context.app.service('rooms').find({
		query: {
			personalId: id
		}
	});

	await Promise.all(rooms.data.map((room) => context.app.service('rooms').remove(room.id)));

	// Remove all organization admin relations
	const orgAdmins = await context.app.service('organizationAdmins').find({
		query: {
			userId: id
		}
	});

	await Promise.all(orgAdmins.data.map((orgAdmin) => context.app.service('organizationAdmins').remove(orgAdmin.id)));

	// Remove all organization owner relations
	const orgOwners = await context.app.service('organizationOwners').find({
		query: {
			userId: id
		}
	});

	await Promise.all(orgOwners.data.map((orgOwner) => context.app.service('organizationOwners').remove(orgOwner.id)));
};