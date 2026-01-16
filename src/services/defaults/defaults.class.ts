// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Default, DefaultData, DefaultPatch, DefaultQuery } from './defaults.schema';

export type { Default, DefaultData, DefaultPatch, DefaultQuery };

export type DefaultParams = KnexAdapterParams<DefaultQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class DefaultService<ServiceParams extends Params = DefaultParams> extends KnexService<
	Default,
	DefaultData,
	DefaultParams,
	DefaultPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'defaults'
	};
};
