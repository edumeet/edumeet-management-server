// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	mediaNodesDataValidator,
	mediaNodesPatchValidator,
	mediaNodesQueryValidator,
	mediaNodesResolver,
	mediaNodesExternalResolver,
	mediaNodesDataResolver,
	mediaNodesPatchResolver,
	mediaNodesQueryResolver
} from './mediaNodes.schema';

import type { Application } from '../../declarations';
import { MediaNodesService, getOptions } from './mediaNodes.class';
import { mediaNodesPath, mediaNodesMethods } from './mediaNodes.shared';

export * from './mediaNodes.class';
export * from './mediaNodes.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const mediaNodes = (app: Application) => {
	// Register our service on the Feathers application
	app.use(mediaNodesPath, new MediaNodesService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: mediaNodesMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(mediaNodesPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(mediaNodesExternalResolver),
				schemaHooks.resolveResult(mediaNodesResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(mediaNodesQueryValidator),
				schemaHooks.resolveQuery(mediaNodesQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(mediaNodesDataValidator),
				schemaHooks.resolveData(mediaNodesDataResolver)
			],
			patch: [
				schemaHooks.validateData(mediaNodesPatchValidator),
				schemaHooks.resolveData(mediaNodesPatchResolver)
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
		[mediaNodesPath]: MediaNodesService
	}
}
