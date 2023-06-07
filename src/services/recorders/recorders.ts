// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	recorderDataValidator,
	recorderPatchValidator,
	recorderQueryValidator,
	recorderResolver,
	recorderExternalResolver,
	recorderDataResolver,
	recorderPatchResolver,
	recorderQueryResolver
} from './recorders.schema';

import type { Application } from '../../declarations';
import { RecorderService, getOptions } from './recorders.class';
import { checkPermissions } from '../../hooks/checkPermissions';

export * from './recorders.class';
export * from './recorders.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const recorder = (app: Application) => {
	// Register our service on the Feathers application
	app.use('recorders', new RecorderService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('recorders').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(recorderExternalResolver),
				schemaHooks.resolveResult(recorderResolver)
			]
		},
		before: {
			all: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				schemaHooks.validateQuery(recorderQueryValidator),
				schemaHooks.resolveQuery(recorderQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(recorderDataValidator),
				schemaHooks.resolveData(recorderDataResolver)
			],
			patch: [
				schemaHooks.validateData(recorderPatchValidator),
				schemaHooks.resolveData(recorderPatchResolver)
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
		recorders: RecorderService
	}
}
