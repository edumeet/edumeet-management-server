// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { CoHost, CoHostData, CoHostPatch, CoHostQuery } from './coHosts.schema';

export type CoHostParams = KnexAdapterParams<CoHostQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class CoHostService<ServiceParams extends Params = CoHostParams> extends KnexService<
	CoHost,
	CoHostData,
	ServiceParams,
	CoHostPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'coHosts'
	};
};
