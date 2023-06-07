// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	rolePermissionDataValidator,
	rolePermissionPatchValidator,
	rolePermissionQueryValidator,
	rolePermissionResolver,
	rolePermissionExternalResolver,
	rolePermissionDataResolver,
	rolePermissionPatchResolver,
	rolePermissionQueryResolver
} from './rolePermissions.schema';

import type { Application } from '../../declarations';
import { RolePermissionService, getOptions } from './rolePermissions.class';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './rolePermissions.class';
export * from './rolePermissions.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const rolePermission = (app: Application) => {
	// Register our service on the Feathers application
	app.use('rolePermissions', new RolePermissionService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('rolePermissions').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(rolePermissionExternalResolver),
				schemaHooks.resolveResult(rolePermissionResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(rolePermissionQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(rolePermissionQueryResolver))
			],
			find: [],
			get: [],
			create: [
				// TODO: Add a hook to check if the role belongs to the same tenant as the user
				schemaHooks.validateData(rolePermissionDataValidator),
				schemaHooks.resolveData(rolePermissionDataResolver)
			],
			patch: [
				schemaHooks.validateData(rolePermissionPatchValidator),
				schemaHooks.resolveData(rolePermissionPatchResolver)
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
		rolePermissions: RolePermissionService
	}
}
