// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { Room, RoomData, RoomPatch, RoomQuery, RoomService } from './rooms.class';

export type { Room, RoomData, RoomPatch, RoomQuery };

export type RoomClientService = Pick<RoomService<Params<RoomQuery>>, (typeof roomMethods)[number]>

export const roomPath = 'rooms';

export const roomMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const roomClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(roomPath, connection.service(roomPath), {
		methods: roomMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[roomPath]: RoomClientService
	}
}
