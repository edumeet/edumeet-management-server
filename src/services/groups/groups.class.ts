// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Group, GroupData, GroupPatch, GroupQuery } from './groups.schema';

export type GroupParams = KnexAdapterParams<GroupQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class GroupService<ServiceParams extends Params = GroupParams> extends KnexService<
	Group,
	GroupData,
	ServiceParams,
	GroupPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'groups'
	};
};
