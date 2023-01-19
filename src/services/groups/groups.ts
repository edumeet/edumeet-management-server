// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	groupDataValidator,
	groupPatchValidator,
	groupQueryValidator,
	groupResolver,
	groupExternalResolver,
	groupDataResolver,
	groupPatchResolver,
	groupQueryResolver
} from './groups.schema';

import type { Application } from '../../declarations';
import { GroupService, getOptions } from './groups.class';

export * from './groups.class';
export * from './groups.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const group = (app: Application) => {
	// Register our service on the Feathers application
	app.use('groups', new GroupService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('groups').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(groupExternalResolver),
				schemaHooks.resolveResult(groupResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(groupQueryValidator), schemaHooks.resolveQuery(groupQueryResolver) ],
			find: [],
			get: [],
			create: [ schemaHooks.validateData(groupDataValidator), schemaHooks.resolveData(groupDataResolver) ],
			patch: [ schemaHooks.validateData(groupPatchValidator), schemaHooks.resolveData(groupPatchResolver) ],
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
		groups: GroupService
	}
}
