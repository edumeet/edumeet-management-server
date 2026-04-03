import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { ResolvedUser, ResolvedUserData, ResolvedUserPatch, ResolvedUserQuery } from './resolvedUsers.schema';

export type { ResolvedUser, ResolvedUserData, ResolvedUserPatch, ResolvedUserQuery };

export type ResolvedUserParams = KnexAdapterParams<ResolvedUserQuery>

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export class ResolvedUserService<ServiceParams extends Params = ResolvedUserParams> extends KnexService<
	ResolvedUser,
	ResolvedUserData,
	ResolvedUserParams,
	ResolvedUserPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'resolvedUsers'
	};
};
