import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	TenantBotCredential,
	TenantBotCredentialData,
	TenantBotCredentialPatch,
	TenantBotCredentialQuery,
	TenantBotCredentialService
} from './tenantBotCredentials.class';

export type { TenantBotCredential, TenantBotCredentialData, TenantBotCredentialPatch, TenantBotCredentialQuery };

export type TenantBotCredentialClientService = Pick<
	TenantBotCredentialService<Params<TenantBotCredentialQuery>>,
	(typeof tenantBotCredentialMethods)[number]
>

export const tenantBotCredentialPath = 'tenantBotCredentials';

export const tenantBotCredentialMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const tenantBotCredentialClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(tenantBotCredentialPath, connection.service(tenantBotCredentialPath), {
		methods: tenantBotCredentialMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[tenantBotCredentialPath]: TenantBotCredentialClientService
	}
}
