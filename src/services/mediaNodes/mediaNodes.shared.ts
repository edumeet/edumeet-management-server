// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	MediaNodes,
	MediaNodesData,
	MediaNodesPatch,
	MediaNodesQuery,
	MediaNodesService
} from './mediaNodes.class';

export type { MediaNodes, MediaNodesData, MediaNodesPatch, MediaNodesQuery };

export type MediaNodesClientService = Pick<MediaNodesService<Params<MediaNodesQuery>>, (typeof mediaNodesMethods)[number]>

export const mediaNodesPath = 'mediaNodes';

export const mediaNodesMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const mediaNodesClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(mediaNodesPath, connection.service(mediaNodesPath), {
		methods: mediaNodesMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[mediaNodesPath]: MediaNodesClientService
	}
}
