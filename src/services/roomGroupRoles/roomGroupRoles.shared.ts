// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	RoomGroupRole,
	RoomGroupRoleData,
	RoomGroupRolePatch,
	RoomGroupRoleQuery,
	RoomGroupRoleService
} from './roomGroupRoles.class';

export type { RoomGroupRole, RoomGroupRoleData, RoomGroupRolePatch, RoomGroupRoleQuery };

export type RoomGroupRoleClientService = Pick<
	RoomGroupRoleService<Params<RoomGroupRoleQuery>>,
	(typeof roomGroupRoleMethods)[number]
>

export const roomGroupRolePath = 'roomGroupRoles';

export const roomGroupRoleMethods = [ 'find', 'get', 'create', 'remove' ] as const;

export const roomGroupRoleClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(roomGroupRolePath, connection.service(roomGroupRolePath), {
		methods: roomGroupRoleMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[roomGroupRolePath]: RoomGroupRoleClientService
	}
}
