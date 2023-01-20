// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	TenantFqdn,
	TenantFqdnData,
	TenantFqdnPatch,
	TenantFqdnQuery
} from './tenantFQDNs.schema';

export type TenantFqdnParams = KnexAdapterParams<TenantFqdnQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class TenantFqdnService<
	ServiceParams extends Params = TenantFqdnParams
> extends KnexService<TenantFqdn, TenantFqdnData, ServiceParams, TenantFqdnPatch> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'tenantFQDNs'
	};
};
