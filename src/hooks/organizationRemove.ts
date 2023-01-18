import { HookContext, NextFunction } from '../declarations';
import { Organization } from '../services/organizations/organizations.schema';

export const organizationRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed organization
	const { id } = context.result as Organization;

	// Remove all organization admins
	const organizationAdmins = await context.app.service('organizationAdmins').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(organizationAdmins.data.map((organizationAdmin) => context.app.service('organizationAdmins').remove(organizationAdmin.id)));

	// Remove all organization owners
	const organizationOwners = await context.app.service('organizationOwners').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(organizationOwners.data.map((organizationOwner) => context.app.service('organizationOwners').remove(organizationOwner.id)));

	// Remove all roles
	const roles = await context.app.service('roles').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(roles.data.map((role) => context.app.service('roles').remove(role.id)));

	// Remove all groups
	const groups = await context.app.service('groups').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(groups.data.map((group) => context.app.service('groups').remove(group.id)));

	// Remove all users
	const users = await context.app.service('users').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(users.data.map((user) => context.app.service('users').remove(user.id)));

	// Remove all room relations
	const rooms = await context.app.service('rooms').find({
		query: {
			organizationId: id
		}
	});

	await Promise.all(rooms.data.map((room) => context.app.service('rooms').remove(room.id)));

	/* TODO: should this happen?
	
	// Remove all media-nodes
	const mediaNodes = await context.app.service('mediaNodes').find({
		query: {
			organizationOwnerId: id
		}
	});

	await Promise.all(mediaNodes.data.map((mediaNode) => context.app.service('mediaNodes').remove(mediaNode.id)));
	
	*/
};