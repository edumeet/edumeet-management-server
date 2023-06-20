// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	RoomOwner,
	RoomOwnerData,
	RoomOwnerPatch,
	RoomOwnerQuery,
	RoomOwnerService
} from './roomOwners.class';

export type { RoomOwner, RoomOwnerData, RoomOwnerPatch, RoomOwnerQuery };

export type RoomOwnerClientService = Pick<
	RoomOwnerService<Params<RoomOwnerQuery>>,
	(typeof roomOwnerMethods)[number]
>

export const roomOwnerPath = 'roomOwners';

export const roomOwnerMethods = [ 'find', 'get', 'create', 'remove' ] as const;

export const roomOwnerClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(roomOwnerPath, connection.service(roomOwnerPath), {
		methods: roomOwnerMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[roomOwnerPath]: RoomOwnerClientService
	}
}
