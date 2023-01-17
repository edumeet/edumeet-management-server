import { HookContext, NextFunction } from '../declarations';
import { Organization } from '../services/organizations/organizations.schema';

export const organizationRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed organization
	const { id } = context.result as Organization;

	// Remove all users
	const users = await context.app.service('users').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(users.data.map((user) => context.app.service('users').remove(user.id)));

	// Remove all room relations (should be removed by userRemove hook, but just in case)
	const rooms = await context.app.service('rooms').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(rooms.data.map((room) => context.app.service('rooms').remove(room.id)));

	/* TODO: should this happen
	
	// Remove all media-nodes
	const mediaNodes = await context.app.service('mediaNodes').find({
		query: {
			organizationOwnerId: id
		}
	});

	await Promise.all(mediaNodes.data.map((mediaNode) => context.app.service('mediaNodes').remove(mediaNode.id)));
	
	*/
};