// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Room, RoomData, RoomPatch, RoomQuery } from './rooms.schema';

export type { Room, RoomData, RoomPatch, RoomQuery };

export type RoomParams = KnexAdapterParams<RoomQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RoomService<ServiceParams extends Params = RoomParams> extends KnexService<
	Room,
	RoomData,
	RoomParams,
	RoomPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'rooms'
	};
};
