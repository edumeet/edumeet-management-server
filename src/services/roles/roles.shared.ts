// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { Role, RoleData, RolePatch, RoleQuery, RoleService } from './roles.class';

export type { Role, RoleData, RolePatch, RoleQuery };

export type RoleClientService = Pick<RoleService<Params<RoleQuery>>, (typeof roleMethods)[number]>

export const rolePath = 'roles';

export const roleMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const roleClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(rolePath, connection.service(rolePath), {
		methods: roleMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[rolePath]: RoleClientService
	}
}
