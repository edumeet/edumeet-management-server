// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roomUserRoleDataValidator,
	roomUserRolePatchValidator,
	roomUserRoleQueryValidator,
	roomUserRoleResolver,
	roomUserRoleExternalResolver,
	roomUserRoleDataResolver,
	roomUserRolePatchResolver,
	roomUserRoleQueryResolver
} from './roomUserRoles.schema';

import type { Application } from '../../declarations';
import { RoomUserRoleService, getOptions } from './roomUserRoles.class';
import { isRoomOwnerOrAdmin } from '../../hooks/isRoomOwnerOrAdmin';

export * from './roomUserRoles.class';
export * from './roomUserRoles.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const roomUserRole = (app: Application) => {
	// Register our service on the Feathers application
	app.use('roomUserRoles', new RoomUserRoleService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('roomUserRoles').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roomUserRoleExternalResolver),
				schemaHooks.resolveResult(roomUserRoleResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(roomUserRoleQueryValidator),
				schemaHooks.resolveQuery(roomUserRoleQueryResolver)
			],
			find: [],
			get: [],
			create: [
				isRoomOwnerOrAdmin,
				schemaHooks.validateData(roomUserRoleDataValidator),
				schemaHooks.resolveData(roomUserRoleDataResolver)
			],
			patch: [
				isRoomOwnerOrAdmin,
				schemaHooks.validateData(roomUserRolePatchValidator),
				schemaHooks.resolveData(roomUserRolePatchResolver)
			],
			remove: [ isRoomOwnerOrAdmin ]
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
		roomUserRoles: RoomUserRoleService
	}
}
