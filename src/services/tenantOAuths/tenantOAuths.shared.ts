// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	TenantOAuth,
	TenantOAuthData,
	TenantOAuthPatch,
	TenantOAuthQuery,
	TenantOAuthService
} from './tenantOAuths.class';

export type { TenantOAuth, TenantOAuthData, TenantOAuthPatch, TenantOAuthQuery };

export type TenantOAuthClientService = Pick<
	TenantOAuthService<Params<TenantOAuthQuery>>,
	(typeof tenantOAuthMethods)[number]
>

export const tenantOAuthPath = 'tenantOAuths';

export const tenantOAuthMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantOAuthClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantOAuthPath, connection.service(tenantOAuthPath), {
		methods: tenantOAuthMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[tenantOAuthPath]: TenantOAuthClientService
	}
}
