import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	TenantInviteConfig,
	TenantInviteConfigData,
	TenantInviteConfigPatch,
	TenantInviteConfigQuery
} from './tenantInviteConfigs.schema';

export type { TenantInviteConfig, TenantInviteConfigData, TenantInviteConfigPatch, TenantInviteConfigQuery };

export type TenantInviteConfigParams = KnexAdapterParams<TenantInviteConfigQuery>

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export class TenantInviteConfigService<ServiceParams extends Params = TenantInviteConfigParams> extends KnexService<
	TenantInviteConfig,
	TenantInviteConfigData,
	TenantInviteConfigParams,
	TenantInviteConfigPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'tenantInviteConfigs'
	};
};
