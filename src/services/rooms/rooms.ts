// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roomDataValidator,
	roomPatchValidator,
	roomQueryValidator,
	roomResolver,
	roomExternalResolver,
	roomDataResolver,
	roomPatchResolver,
	roomQueryResolver
} from './rooms.schema';

import type { Application } from '../../declarations';
import { RoomService, getOptions } from './rooms.class';
import { isRoomOwnerOrAdmin } from '../../hooks/isRoomOwnerOrAdmin';
import { addRoomOwner } from '../../hooks/addRoomOwner';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './rooms.class';
export * from './rooms.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const room = (app: Application) => {
	// Register our service on the Feathers application
	app.use('rooms', new RoomService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('rooms').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roomExternalResolver),
				schemaHooks.resolveResult(roomResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(roomQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(roomQueryResolver))
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(roomDataValidator),
				schemaHooks.resolveData(roomDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isRoomOwnerOrAdmin),
				schemaHooks.validateData(roomPatchValidator),
				schemaHooks.resolveData(roomPatchResolver)
			],
			remove: [ iff(notSuperAdmin(), isRoomOwnerOrAdmin) ]
		},
		after: {
			all: [],
			create: [ addRoomOwner ],
		},
		error: {
			all: []
		}
	});
};

// Add this service to the service type index
declare module '../../declarations' {
	interface ServiceTypes {
		rooms: RoomService
	}
}
