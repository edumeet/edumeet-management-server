import { HookContext, NextFunction } from '../declarations';
import { User } from '../services/users/users.schema';

export const userRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed user
	const { id } = context.result as User;

	// Remove all coHost relations
	const coHosts = await context.app.service('coHosts').find({
		query: {
			userId: id
		}
	});

	await Promise.all(coHosts.data.map((coHost) => context.app.service('coHosts').remove(coHost.id)));

	// Remove all room relations
	const rooms = await context.app.service('rooms').find({
		query: {
			roomOwnerId: id
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
};