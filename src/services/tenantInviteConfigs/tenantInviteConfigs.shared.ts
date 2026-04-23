import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	TenantInviteConfig,
	TenantInviteConfigData,
	TenantInviteConfigPatch,
	TenantInviteConfigQuery,
	TenantInviteConfigService
} from './tenantInviteConfigs.class';

export type { TenantInviteConfig, TenantInviteConfigData, TenantInviteConfigPatch, TenantInviteConfigQuery };

export type TenantInviteConfigClientService = Pick<
	TenantInviteConfigService<Params<TenantInviteConfigQuery>>,
	(typeof tenantInviteConfigMethods)[number]
>

export const tenantInviteConfigPath = 'tenantInviteConfigs';

export const tenantInviteConfigMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantInviteConfigClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantInviteConfigPath, connection.service(tenantInviteConfigPath), {
		methods: tenantInviteConfigMethods
	});
};

declare module '../../client' {
	interface ServiceTypes {
		[tenantInviteConfigPath]: TenantInviteConfigClientService
	}
}
