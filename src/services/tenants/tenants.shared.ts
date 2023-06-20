// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { Tenant, TenantData, TenantPatch, TenantQuery, TenantService } from './tenants.class';

export type { Tenant, TenantData, TenantPatch, TenantQuery };

export type TenantClientService = Pick<TenantService<Params<TenantQuery>>, (typeof tenantMethods)[number]>

export const tenantPath = 'tenants';

export const tenantMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantPath, connection.service(tenantPath), {
		methods: tenantMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[tenantPath]: TenantClientService
	}
}
