import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';

interface CheckPermissionsOptions {
	entity?: string;
	field?: string;
	error?: boolean;
	roles: string[];
}

export const checkPermissions = (options: CheckPermissionsOptions) => {
	const {
		entity: entityName = 'user',
		field = 'roles',
		error = true
	} = options;

	if (!Array.isArray(options.roles))
		throw new Error('\'roles\' option must be an array');

	return async (context: HookContext) => {
		const { params, type, method } = context;

		if (type !== 'before')
			throw new Error('The hook should only be used as a \'before\' hook.');

		const entity = context.params[entityName];

		if (!entity) {
			if (params.provider)
				throw new Forbidden('You do not have the correct permissions (invalid permission entity).');

			return context;
		}

		// Normalize permissions. They can either be a comma separated string or an array.
		const permissionList = entity[field];
		const requiredPermissions: string[] = [ '*', `*:${method}` ];

		options.roles.forEach((permission: string) => {
			requiredPermissions.push(
				`${permission}`,
				`${permission}:*`,
				`${permission}:${method}`
			);
		});

		const permitted = permissionList.some((current: string) => requiredPermissions.includes(current));

		if (error !== false && !permitted)
			throw new Forbidden('You do not have the correct permissions.');

		context.params = {
			permitted,
			...params
		};

		return context;
	};
};