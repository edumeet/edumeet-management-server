// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	organizationOwnerDataValidator,
	organizationOwnerPatchValidator,
	organizationOwnerQueryValidator,
	organizationOwnerResolver,
	organizationOwnerExternalResolver,
	organizationOwnerDataResolver,
	organizationOwnerPatchResolver,
	organizationOwnerQueryResolver
} from './organizationOwners.schema';

import type { Application } from '../../declarations';
import { OrganizationOwnerService, getOptions } from './organizationOwners.class';

export * from './organizationOwners.class';
export * from './organizationOwners.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const organizationOwner = (app: Application) => {
	// Register our service on the Feathers application
	app.use('organizationOwners', new OrganizationOwnerService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('organizationOwners').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(organizationOwnerExternalResolver),
				schemaHooks.resolveResult(organizationOwnerResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(organizationOwnerQueryValidator),
				schemaHooks.resolveQuery(organizationOwnerQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(organizationOwnerDataValidator),
				schemaHooks.resolveData(organizationOwnerDataResolver)
			],
			patch: [
				schemaHooks.validateData(organizationOwnerPatchValidator),
				schemaHooks.resolveData(organizationOwnerPatchResolver)
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
		organizationOwners: OrganizationOwnerService
	}
}
