// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	Permission,
	PermissionData,
	PermissionPatch,
	PermissionQuery,
	PermissionService
} from './permissions.class';

export type { Permission, PermissionData, PermissionPatch, PermissionQuery };

export type PermissionClientService = Pick<
	PermissionService<Params<PermissionQuery>>,
	(typeof permissionMethods)[number]
>

export const permissionPath = 'permissions';

export const permissionMethods = [ 'find', 'get' ] as const;

export const permissionClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(permissionPath, connection.service(permissionPath), {
		methods: permissionMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[permissionPath]: PermissionClientService
	}
}
