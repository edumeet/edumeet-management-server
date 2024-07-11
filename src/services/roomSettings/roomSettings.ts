// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roomSettingsDataValidator,
	roomSettingsPatchValidator,
	roomSettingsQueryValidator,
	roomSettingsResolver,
	roomSettingsExternalResolver,
	roomSettingsDataResolver,
	roomSettingsPatchResolver,
	roomSettingsQueryResolver
} from './roomSettings.schema';

import type { Application } from '../../declarations';
import { RoomSettingsService, getOptions } from './roomSettings.class';
import { roomSettingsPath, roomSettingsMethods } from './roomSettings.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './roomSettings.class';
export * from './roomSettings.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const roomSettings = (app: Application) => {
	// Register our service on the Feathers application
	app.use(roomSettingsPath, new RoomSettingsService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: roomSettingsMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(roomSettingsPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roomSettingsExternalResolver),
				schemaHooks.resolveResult(roomSettingsResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(roomSettingsQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(roomSettingsQueryResolver))
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(roomSettingsDataValidator),
				schemaHooks.resolveData(roomSettingsDataResolver)
			],
			patch: [
				schemaHooks.validateData(roomSettingsPatchValidator),
				schemaHooks.resolveData(roomSettingsPatchResolver)
			],
			remove: [ ]
		},
		after: {
			all: []
		},
		error: {
			all: []
		}
	});
};

// Add this service to the service type index
declare module '../../declarations' {
	interface ServiceTypes {
		[roomSettingsPath]: RoomSettingsService
	}
}
