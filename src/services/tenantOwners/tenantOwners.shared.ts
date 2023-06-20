// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	TenantOwner,
	TenantOwnerData,
	TenantOwnerPatch,
	TenantOwnerQuery,
	TenantOwnerService
} from './tenantOwners.class';

export type { TenantOwner, TenantOwnerData, TenantOwnerPatch, TenantOwnerQuery };

export type TenantOwnerClientService = Pick<
	TenantOwnerService<Params<TenantOwnerQuery>>,
	(typeof tenantOwnerMethods)[number]
>

export const tenantOwnerPath = 'tenantOwners';

export const tenantOwnerMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantOwnerClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantOwnerPath, connection.service(tenantOwnerPath), {
		methods: tenantOwnerMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[tenantOwnerPath]: TenantOwnerClientService
	}
}
