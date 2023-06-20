// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	RoomUserRole,
	RoomUserRoleData,
	RoomUserRolePatch,
	RoomUserRoleQuery,
	RoomUserRoleService
} from './roomUserRoles.class';

export type { RoomUserRole, RoomUserRoleData, RoomUserRolePatch, RoomUserRoleQuery };

export type RoomUserRoleClientService = Pick<
	RoomUserRoleService<Params<RoomUserRoleQuery>>,
	(typeof roomUserRoleMethods)[number]
>

export const roomUserRolePath = 'roomUserRoles';

export const roomUserRoleMethods = [ 'find', 'get', 'create', 'remove' ] as const;

export const roomUserRoleClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(roomUserRolePath, connection.service(roomUserRolePath), {
		methods: roomUserRoleMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[roomUserRolePath]: RoomUserRoleClientService
	}
}
