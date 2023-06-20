// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	RoomUserRole,
	RoomUserRoleData,
	RoomUserRolePatch,
	RoomUserRoleQuery
} from './roomUserRoles.schema';

export type { RoomUserRole, RoomUserRoleData, RoomUserRolePatch, RoomUserRoleQuery };

export type RoomUserRoleParams = KnexAdapterParams<RoomUserRoleQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RoomUserRoleService<ServiceParams extends Params = RoomUserRoleParams> extends KnexService<
	RoomUserRole,
	RoomUserRoleData,
	RoomUserRoleParams,
	RoomUserRolePatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'roomUserRoles'
	};
};
