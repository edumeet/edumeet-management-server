// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { RoomSettings, RoomSettingsData, RoomSettingsPatch, RoomSettingsQuery, RoomSettingsService } from './roomSettings.class';

export type { RoomSettings, RoomSettingsData, RoomSettingsPatch, RoomSettingsQuery };

export type RoomSettingsClientService = Pick<RoomSettingsService<Params<RoomSettingsQuery>>, (typeof roomSettingsMethods)[number]>

export const roomSettingsPath = 'roomSettings';

export const roomSettingsMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const roomSettingsClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(roomSettingsPath, connection.service(roomSettingsPath), {
		methods: roomSettingsMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[roomSettingsPath]: RoomSettingsClientService
	}
}
