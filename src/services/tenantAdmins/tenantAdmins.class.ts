// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	TenantAdmin,
	TenantAdminData,
	TenantAdminPatch,
	TenantAdminQuery
} from './tenantAdmins.schema';

export type TenantAdminParams = KnexAdapterParams<TenantAdminQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class TenantAdminService<
	ServiceParams extends Params = TenantAdminParams
> extends KnexService<TenantAdmin, TenantAdminData, ServiceParams, TenantAdminPatch> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'tenantAdmins'
	};
};
