// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Tenant, TenantData, TenantPatch, TenantQuery } from './tenants.schema';

export type { Tenant, TenantData, TenantPatch, TenantQuery };

export type TenantParams = KnexAdapterParams<TenantQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class TenantService<ServiceParams extends Params = TenantParams> extends KnexService<
	Tenant,
	TenantData,
	TenantParams,
	TenantPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'tenants'
	};
};
