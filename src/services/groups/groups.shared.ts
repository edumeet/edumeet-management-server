// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { Group, GroupData, GroupPatch, GroupQuery, GroupService } from './groups.class';

export type { Group, GroupData, GroupPatch, GroupQuery };

export type GroupClientService = Pick<GroupService<Params<GroupQuery>>, (typeof groupMethods)[number]>

export const groupPath = 'groups';

export const groupMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const groupClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(groupPath, connection.service(groupPath), {
		methods: groupMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[groupPath]: GroupClientService
	}
}
