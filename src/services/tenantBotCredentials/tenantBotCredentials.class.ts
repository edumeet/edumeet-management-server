import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	TenantBotCredential,
	TenantBotCredentialData,
	TenantBotCredentialPatch,
	TenantBotCredentialQuery
} from './tenantBotCredentials.schema';

export type { TenantBotCredential, TenantBotCredentialData, TenantBotCredentialPatch, TenantBotCredentialQuery };

export type TenantBotCredentialParams = KnexAdapterParams<TenantBotCredentialQuery>

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export class TenantBotCredentialService<ServiceParams extends Params = TenantBotCredentialParams> extends KnexService<
	TenantBotCredential,
	TenantBotCredentialData,
	TenantBotCredentialParams,
	TenantBotCredentialPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'tenantBotCredentials'
	};
};
