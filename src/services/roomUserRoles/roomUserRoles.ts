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
import { roomUserRolePath, roomUserRoleMethods } from './roomUserRoles.shared';
import { isRoomOwnerOrAdminRoomIdOfUserRole } from '../../hooks/isRoomOwnerOrAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { BadRequest, Forbidden } from '@feathersjs/errors';

export * from './roomUserRoles.class';
export * from './roomUserRoles.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const roomUserRole = (app: Application) => {
	// Register our service on the Feathers application
	app.use(roomUserRolePath, new RoomUserRoleService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: roomUserRoleMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(roomUserRolePath).hooks({
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
				iff(notSuperAdmin(), schemaHooks.resolveQuery(roomUserRoleQueryResolver))
			],
			find: [
				iff(notSuperAdmin(), async (context) => {
					const q = context.params.query || {};

					if ((q as any).roomId == null) {
						throw new BadRequest('roomId is required');
					}

					return context;
				}),
				iff(notSuperAdmin(), isRoomOwnerOrAdminRoomIdOfUserRole)
			],
			get: [
				iff(notSuperAdmin(), isRoomOwnerOrAdminRoomIdOfUserRole)
			],
			create: [
				iff(notSuperAdmin(), isRoomOwnerOrAdminRoomIdOfUserRole),
				schemaHooks.validateData(roomUserRoleDataValidator),
				schemaHooks.resolveData(roomUserRoleDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isRoomOwnerOrAdminRoomIdOfUserRole),
				schemaHooks.validateData(roomUserRolePatchValidator),
				schemaHooks.resolveData(roomUserRolePatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), isRoomOwnerOrAdminRoomIdOfUserRole)
			]
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
		[roomUserRolePath]: RoomUserRoleService
	}
}
