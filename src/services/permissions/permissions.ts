// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	permissionDataValidator,
	permissionPatchValidator,
	permissionQueryValidator,
	permissionResolver,
	permissionExternalResolver,
	permissionDataResolver,
	permissionPatchResolver,
	permissionQueryResolver
} from './permissions.schema';

import type { Application } from '../../declarations';
import { PermissionService, getOptions } from './permissions.class';

export * from './permissions.class';
export * from './permissions.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const permission = (app: Application) => {
	// Register our service on the Feathers application
	app.use('permissions', new PermissionService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('permissions').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(permissionExternalResolver),
				schemaHooks.resolveResult(permissionResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(permissionQueryValidator),
				schemaHooks.resolveQuery(permissionQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(permissionDataValidator),
				schemaHooks.resolveData(permissionDataResolver)
			],
			patch: [
				schemaHooks.validateData(permissionPatchValidator),
				schemaHooks.resolveData(permissionPatchResolver)
			],
			remove: []
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
		permissions: PermissionService
	}
}
