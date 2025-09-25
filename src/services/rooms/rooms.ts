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
import { roomPath, roomMethods } from './rooms.shared';
import { isRoomOwnerOrAdmin } from '../../hooks/isRoomOwnerOrAdmin';
import { addRoomOwner } from '../../hooks/addRoomOwner';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import filterByRoomOwnership from '../../hooks/filterByRoomOwnership';
import { tenantUserManagedRoomNumberLimit } from '../../hooks/tenantUserManagedRoomNumberLimit';
import { tenantRoomLimit } from '../../hooks/tenantUserRoomLimit';
import { notTenantManager } from '../../hooks/notTenantManager';
import { tenantManagerManagedRoomNumberLimit } from '../../hooks/managerManagedRoomNumberLimit';

export * from './rooms.class';
export * from './rooms.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const room = (app: Application) => {
	// Register our service on the Feathers application
	app.use(roomPath, new RoomService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: roomMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(roomPath).hooks({
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
			find: [ iff(notSuperAdmin(), filterByRoomOwnership) ],
			get: [ 
				iff(notSuperAdmin(), filterByRoomOwnership)
			],
			create: [
				iff(notSuperAdmin(), iff(notTenantManager(), tenantUserManagedRoomNumberLimit)), // limits all room count for user under a tenant
				iff(notSuperAdmin(), iff(!notTenantManager(), tenantManagerManagedRoomNumberLimit)), // limits all room count for tenant admin user under a tenant
				iff(notSuperAdmin(), tenantRoomLimit), // limits all room count under a tenant
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
			get: [],
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
		[roomPath]: RoomService
	}
}
