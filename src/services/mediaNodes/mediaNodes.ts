// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	mediaNodeDataValidator,
	mediaNodePatchValidator,
	mediaNodeQueryValidator,
	mediaNodeResolver,
	mediaNodeExternalResolver,
	mediaNodeDataResolver,
	mediaNodePatchResolver,
	mediaNodeQueryResolver
} from './mediaNodes.schema';

import type { Application } from '../../declarations';
import { MediaNodeService, getOptions } from './mediaNodes.class';
import { checkPermissions } from '../../hooks/checkPermissions';

export * from './mediaNodes.class';
export * from './mediaNodes.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const mediaNode = (app: Application) => {
	// Register our service on the Feathers application
	app.use('mediaNodes', new MediaNodeService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('mediaNodes').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(mediaNodeExternalResolver),
				schemaHooks.resolveResult(mediaNodeResolver)
			]
		},
		before: {
			all: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				schemaHooks.validateQuery(mediaNodeQueryValidator),
				schemaHooks.resolveQuery(mediaNodeQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(mediaNodeDataValidator),
				schemaHooks.resolveData(mediaNodeDataResolver)
			],
			patch: [
				schemaHooks.validateData(mediaNodePatchValidator),
				schemaHooks.resolveData(mediaNodePatchResolver)
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
    mediaNodes: MediaNodeService
  }
}
