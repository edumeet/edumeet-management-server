// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	RolePermission,
	RolePermissionData,
	RolePermissionPatch,
	RolePermissionQuery,
	RolePermissionService
} from './rolePermissions.class';

export type { RolePermission, RolePermissionData, RolePermissionPatch, RolePermissionQuery };

export type RolePermissionClientService = Pick<
	RolePermissionService<Params<RolePermissionQuery>>,
	(typeof rolePermissionMethods)[number]
>

export const rolePermissionPath = 'rolePermissions';

export const rolePermissionMethods = [ 'find', 'get', 'create', 'remove' ] as const;

export const rolePermissionClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(rolePermissionPath, connection.service(rolePermissionPath), {
		methods: rolePermissionMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[rolePermissionPath]: RolePermissionClientService
	}
}
