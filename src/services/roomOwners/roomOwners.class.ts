// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { RoomOwner, RoomOwnerData, RoomOwnerPatch, RoomOwnerQuery } from './roomOwners.schema';

export type { RoomOwner, RoomOwnerData, RoomOwnerPatch, RoomOwnerQuery };

export type RoomOwnerParams = KnexAdapterParams<RoomOwnerQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RoomOwnerService<ServiceParams extends Params = RoomOwnerParams> extends KnexService<
	RoomOwner,
	RoomOwnerData,
	RoomOwnerParams,
	RoomOwnerPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'roomOwners'
	};
};
