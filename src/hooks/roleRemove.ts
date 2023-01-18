import { HookContext, NextFunction } from '../declarations';
import { Role } from '../services/roles/roles.schema';

export const roleRemove = async (context: HookContext, next: NextFunction) => {
	await next();

	// The removed role
	const { id } = context.result as Role;

	// Remove all permissions for this role
	const permissions = await context.app.service('rolePermissions').find({
		query: {
			roleId: id
		}
	});

	await Promise.all(permissions.data.map((permission) => context.app.service('rolePermissions').remove(permission.id)));

	// Remove all room group roles for this role
	const groupRoles = await context.app.service('roomGroupRoles').find({
		query: {
			roleId: id
		}
	});

	await Promise.all(groupRoles.data.map((groupRole) => context.app.service('roomGroupRoles').remove(groupRole.id)));

	// Remove all room user roles for this role
	const userRoles = await context.app.service('roomUserRoles').find({
		query: {
			roleId: id
		}
	});

	await Promise.all(userRoles.data.map((userRole) => context.app.service('roomUserRoles').remove(userRole.id)));
};