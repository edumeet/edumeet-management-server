// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roomGroupRoleDataValidator,
	roomGroupRolePatchValidator,
	roomGroupRoleQueryValidator,
	roomGroupRoleResolver,
	roomGroupRoleExternalResolver,
	roomGroupRoleDataResolver,
	roomGroupRolePatchResolver,
	roomGroupRoleQueryResolver
} from './roomGroupRoles.schema';

import type { Application } from '../../declarations';
import { RoomGroupRoleService, getOptions } from './roomGroupRoles.class';
import { isRoomOwnerOrAdmin } from '../../hooks/isRoomOwnerOrAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './roomGroupRoles.class';
export * from './roomGroupRoles.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const roomGroupRole = (app: Application) => {
	// Register our service on the Feathers application
	app.use('roomGroupRoles', new RoomGroupRoleService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('roomGroupRoles').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roomGroupRoleExternalResolver),
				schemaHooks.resolveResult(roomGroupRoleResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(roomGroupRoleQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(roomGroupRoleQueryResolver))
			],
			find: [],
			get: [],
			create: [
				iff(notSuperAdmin(), isRoomOwnerOrAdmin),
				schemaHooks.validateData(roomGroupRoleDataValidator),
				schemaHooks.resolveData(roomGroupRoleDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isRoomOwnerOrAdmin),
				schemaHooks.validateData(roomGroupRolePatchValidator),
				schemaHooks.resolveData(roomGroupRolePatchResolver)
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
		roomGroupRoles: RoomGroupRoleService
	}
}
