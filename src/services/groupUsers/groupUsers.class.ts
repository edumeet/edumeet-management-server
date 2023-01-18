// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { GroupUser, GroupUserData, GroupUserPatch, GroupUserQuery } from './groupUsers.schema';

export type GroupUserParams = KnexAdapterParams<GroupUserQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class GroupUserService<ServiceParams extends Params = GroupUserParams> extends KnexService<
	GroupUser,
	GroupUserData,
	ServiceParams,
	GroupUserPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'groupUsers'
	};
};
