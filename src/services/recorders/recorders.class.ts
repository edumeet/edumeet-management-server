// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Recorder, RecorderData, RecorderPatch, RecorderQuery } from './recorders.schema';

export type RecorderParams = KnexAdapterParams<RecorderQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RecorderService<ServiceParams extends Params = RecorderParams> extends KnexService<
	Recorder,
	RecorderData,
	ServiceParams,
	RecorderPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'recorders'
	};
};
