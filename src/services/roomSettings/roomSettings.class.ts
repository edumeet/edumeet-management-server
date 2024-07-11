// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	RoomSettings,
	RoomSettingsData,
	RoomSettingsPatch,
	RoomSettingsQuery
} from './roomSettings.schema';

export type { RoomSettings, RoomSettingsData, RoomSettingsPatch, RoomSettingsQuery };

export type RoomSettingsParams = KnexAdapterParams<RoomSettingsQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RoomSettingsService<ServiceParams extends Params = RoomSettingsParams> extends KnexService<
	RoomSettings,
	RoomSettingsData,
	RoomSettingsParams,
	RoomSettingsPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'roomSettings'
	};
};
