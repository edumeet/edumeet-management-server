// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	TenantFqdn,
	TenantFqdnData,
	TenantFqdnPatch,
	TenantFqdnQuery,
	TenantFqdnService
} from './tenantFQDNs.class';

export type { TenantFqdn, TenantFqdnData, TenantFqdnPatch, TenantFqdnQuery };

export type TenantFqdnClientService = Pick<
	TenantFqdnService<Params<TenantFqdnQuery>>,
	(typeof tenantFqdnMethods)[number]
>

export const tenantFqdnPath = 'tenantFQDNs';

export const tenantFqdnMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantFqdnClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantFqdnPath, connection.service(tenantFqdnPath), {
		methods: tenantFqdnMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[tenantFqdnPath]: TenantFqdnClientService
	}
}
