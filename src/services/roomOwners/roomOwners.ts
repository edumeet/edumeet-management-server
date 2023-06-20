// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roomOwnerDataValidator,
	roomOwnerPatchValidator,
	roomOwnerQueryValidator,
	roomOwnerResolver,
	roomOwnerExternalResolver,
	roomOwnerDataResolver,
	roomOwnerPatchResolver,
	roomOwnerQueryResolver
} from './roomOwners.schema';

import type { Application } from '../../declarations';
import { RoomOwnerService, getOptions } from './roomOwners.class';
import { roomOwnerPath, roomOwnerMethods } from './roomOwners.shared';
import { isRoomOwnerOrAdmin } from '../../hooks/isRoomOwnerOrAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './roomOwners.class';
export * from './roomOwners.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const roomOwner = (app: Application) => {
	// Register our service on the Feathers application
	app.use(roomOwnerPath, new RoomOwnerService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: roomOwnerMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(roomOwnerPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roomOwnerExternalResolver),
				schemaHooks.resolveResult(roomOwnerResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(roomOwnerQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(roomOwnerQueryResolver))
			],
			find: [],
			get: [],
			create: [
				iff(notSuperAdmin(), isRoomOwnerOrAdmin),
				schemaHooks.validateData(roomOwnerDataValidator),
				schemaHooks.resolveData(roomOwnerDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isRoomOwnerOrAdmin),
				schemaHooks.validateData(roomOwnerPatchValidator),
				schemaHooks.resolveData(roomOwnerPatchResolver)
			],
			remove: [ iff(notSuperAdmin(), isRoomOwnerOrAdmin) ]
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
		[roomOwnerPath]: RoomOwnerService
	}
}
