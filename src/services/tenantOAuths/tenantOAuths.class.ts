// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { TenantOAuth, TenantOAuthData, TenantOAuthPatch, TenantOAuthQuery } from './tenantOAuths.schema';

export type { TenantOAuth, TenantOAuthData, TenantOAuthPatch, TenantOAuthQuery };

export type TenantOAuthParams = KnexAdapterParams<TenantOAuthQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class TenantOAuthService<ServiceParams extends Params = TenantOAuthParams> extends KnexService<
	TenantOAuth,
	TenantOAuthData,
	TenantOAuthParams,
	TenantOAuthPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'tenantOAuths'
	};
};
