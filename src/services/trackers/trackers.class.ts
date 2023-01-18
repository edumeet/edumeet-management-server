// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Tracker, TrackerData, TrackerPatch, TrackerQuery } from './trackers.schema';

export type TrackerParams = KnexAdapterParams<TrackerQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class TrackerService<ServiceParams extends Params = TrackerParams> extends KnexService<
	Tracker,
	TrackerData,
	ServiceParams,
	TrackerPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'trackers'
	};
};
