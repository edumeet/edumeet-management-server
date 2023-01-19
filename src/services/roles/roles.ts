// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roleDataValidator,
	rolePatchValidator,
	roleQueryValidator,
	roleResolver,
	roleExternalResolver,
	roleDataResolver,
	rolePatchResolver,
	roleQueryResolver
} from './roles.schema';

import type { Application } from '../../declarations';
import { RoleService, getOptions } from './roles.class';

export * from './roles.class';
export * from './roles.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const role = (app: Application) => {
	// Register our service on the Feathers application
	app.use('roles', new RoleService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('roles').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roleExternalResolver),
				schemaHooks.resolveResult(roleResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(roleQueryValidator), schemaHooks.resolveQuery(roleQueryResolver) ],
			find: [],
			get: [],
			create: [ schemaHooks.validateData(roleDataValidator), schemaHooks.resolveData(roleDataResolver) ],
			patch: [ schemaHooks.validateData(rolePatchValidator), schemaHooks.resolveData(rolePatchResolver) ],
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
		roles: RoleService
	}
}
