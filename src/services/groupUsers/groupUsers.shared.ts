// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { GroupUser, GroupUserData, GroupUserPatch, GroupUserQuery, GroupUserService } from './groupUsers.class';

export type { GroupUser, GroupUserData, GroupUserPatch, GroupUserQuery };

export type GroupUserClientService = Pick<GroupUserService<Params<GroupUserQuery>>, (typeof groupUserMethods)[number]>

export const groupUserPath = 'groupUsers';

export const groupUserMethods = [ 'find', 'get', 'create', 'remove' ] as const;

export const groupUserClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(groupUserPath, connection.service(groupUserPath), {
		methods: groupUserMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[groupUserPath]: GroupUserClientService
	}
}
