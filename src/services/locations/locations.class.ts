// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Location, LocationData, LocationPatch, LocationQuery } from './locations.schema';

export type LocationParams = KnexAdapterParams<LocationQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class LocationService<ServiceParams extends Params = LocationParams> extends KnexService<
  Location,
  LocationData,
  ServiceParams,
  LocationPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'locations'
	};
};
