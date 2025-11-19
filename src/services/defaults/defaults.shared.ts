// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { Default, DefaultData, DefaultPatch, DefaultQuery, DefaultService } from './defaults.class';

export type { Default, DefaultData, DefaultPatch, DefaultQuery };

export type DefaultClientService = Pick<DefaultService<Params<DefaultQuery>>, (typeof defaultMethods)[number]>

export const defaultPath = 'defaults';

export const defaultMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const defaultClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(defaultPath, connection.service(defaultPath), {
		methods: defaultMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[defaultPath]: DefaultClientService
	}
}
