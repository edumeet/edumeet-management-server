// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	TenantOwner,
	TenantOwnerData,
	TenantOwnerPatch,
	TenantOwnerQuery
} from './tenantOwners.schema';

export type TenantOwnerParams = KnexAdapterParams<TenantOwnerQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class TenantOwnerService<
	ServiceParams extends Params = TenantOwnerParams
> extends KnexService<TenantOwner, TenantOwnerData, ServiceParams, TenantOwnerPatch> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'tenantOwners'
	};
};
