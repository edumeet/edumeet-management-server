// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	TenantAdmin,
	TenantAdminData,
	TenantAdminPatch,
	TenantAdminQuery,
	TenantAdminService
} from './tenantAdmins.class';

export type { TenantAdmin, TenantAdminData, TenantAdminPatch, TenantAdminQuery };

export type TenantAdminClientService = Pick<
	TenantAdminService<Params<TenantAdminQuery>>,
	(typeof tenantAdminMethods)[number]
>

export const tenantAdminPath = 'tenantAdmins';

export const tenantAdminMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantAdminClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantAdminPath, connection.service(tenantAdminPath), {
		methods: tenantAdminMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[tenantAdminPath]: TenantAdminClientService
	}
}
