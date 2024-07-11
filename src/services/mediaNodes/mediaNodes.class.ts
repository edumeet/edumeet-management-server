// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { MediaNodes, MediaNodesData, MediaNodesPatch, MediaNodesQuery } from './mediaNodes.schema';

export type { MediaNodes, MediaNodesData, MediaNodesPatch, MediaNodesQuery };

export type MediaNodesParams = KnexAdapterParams<MediaNodesQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class MediaNodesService<ServiceParams extends Params = MediaNodesParams> extends KnexService<MediaNodes, MediaNodesData, MediaNodesParams, MediaNodesPatch> { }

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'mediaNodes'
	};
};
