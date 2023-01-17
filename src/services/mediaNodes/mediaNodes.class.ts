// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { MediaNode, MediaNodeData, MediaNodePatch, MediaNodeQuery } from './mediaNodes.schema';

export type MediaNodeParams = KnexAdapterParams<MediaNodeQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class MediaNodeService<ServiceParams extends Params = MediaNodeParams> extends KnexService<
  MediaNode,
  MediaNodeData,
  ServiceParams,
  MediaNodePatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'mediaNodes'
	};
};
