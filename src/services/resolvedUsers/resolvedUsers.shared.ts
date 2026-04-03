import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	ResolvedUser,
	ResolvedUserData,
	ResolvedUserPatch,
	ResolvedUserQuery,
	ResolvedUserService
} from './resolvedUsers.class';

export type { ResolvedUser, ResolvedUserData, ResolvedUserPatch, ResolvedUserQuery };

export type ResolvedUserClientService = Pick<
	ResolvedUserService<Params<ResolvedUserQuery>>,
	(typeof resolvedUserMethods)[number]
>

export const resolvedUserPath = 'resolvedUsers';

export const resolvedUserMethods = [ 'find', 'create', 'remove' ] as const;

export const resolvedUserClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(resolvedUserPath, connection.service(resolvedUserPath), {
		methods: resolvedUserMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[resolvedUserPath]: ResolvedUserClientService
	}
}
