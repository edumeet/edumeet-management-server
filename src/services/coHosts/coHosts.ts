// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	coHostDataValidator,
	coHostPatchValidator,
	coHostQueryValidator,
	coHostResolver,
	coHostExternalResolver,
	coHostDataResolver,
	coHostPatchResolver,
	coHostQueryResolver
} from './coHosts.schema';

import type { Application } from '../../declarations';
import { CoHostService, getOptions } from './coHosts.class';

export * from './coHosts.class';
export * from './coHosts.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const coHost = (app: Application) => {
	// Register our service on the Feathers application
	app.use('coHosts', new CoHostService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('coHosts').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(coHostExternalResolver),
				schemaHooks.resolveResult(coHostResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(coHostQueryValidator), schemaHooks.resolveQuery(coHostQueryResolver) ],
			find: [],
			get: [],
			create: [ schemaHooks.validateData(coHostDataValidator), schemaHooks.resolveData(coHostDataResolver) ],
			patch: [ schemaHooks.validateData(coHostPatchValidator), schemaHooks.resolveData(coHostPatchResolver) ],
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
		coHosts: CoHostService
	}
}
