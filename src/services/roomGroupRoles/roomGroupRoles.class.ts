// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	RoomGroupRole,
	RoomGroupRoleData,
	RoomGroupRolePatch,
	RoomGroupRoleQuery
} from './roomGroupRoles.schema';

export type RoomGroupRoleParams = KnexAdapterParams<RoomGroupRoleQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RoomGroupRoleService<ServiceParams extends Params = RoomGroupRoleParams> extends KnexService<
	RoomGroupRole,
	RoomGroupRoleData,
	ServiceParams,
	RoomGroupRolePatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'roomGroupRoles'
	};
};
