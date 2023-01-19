// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	organizationDataValidator,
	organizationPatchValidator,
	organizationQueryValidator,
	organizationResolver,
	organizationExternalResolver,
	organizationDataResolver,
	organizationPatchResolver,
	organizationQueryResolver
} from './organizations.schema';

import type { Application } from '../../declarations';
import { OrganizationService, getOptions } from './organizations.class';

export * from './organizations.class';
export * from './organizations.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const organization = (app: Application) => {
	// Register our service on the Feathers application
	app.use('organizations', new OrganizationService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('organizations').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(organizationExternalResolver),
				schemaHooks.resolveResult(organizationResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(organizationQueryValidator),
				schemaHooks.resolveQuery(organizationQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(organizationDataValidator),
				schemaHooks.resolveData(organizationDataResolver)
			],
			patch: [
				schemaHooks.validateData(organizationPatchValidator),
				schemaHooks.resolveData(organizationPatchResolver)
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
		organizations: OrganizationService
	}
}
