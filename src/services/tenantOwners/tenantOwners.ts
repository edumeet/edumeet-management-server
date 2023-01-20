// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantOwnerDataValidator,
	tenantOwnerPatchValidator,
	tenantOwnerQueryValidator,
	tenantOwnerResolver,
	tenantOwnerExternalResolver,
	tenantOwnerDataResolver,
	tenantOwnerPatchResolver,
	tenantOwnerQueryResolver
} from './tenantOwners.schema';

import type { Application } from '../../declarations';
import { TenantOwnerService, getOptions } from './tenantOwners.class';

export * from './tenantOwners.class';
export * from './tenantOwners.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenantOwner = (app: Application) => {
	// Register our service on the Feathers application
	app.use('tenantOwners', new TenantOwnerService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('tenantOwners').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantOwnerExternalResolver),
				schemaHooks.resolveResult(tenantOwnerResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantOwnerQueryValidator),
				schemaHooks.resolveQuery(tenantOwnerQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(tenantOwnerDataValidator),
				schemaHooks.resolveData(tenantOwnerDataResolver)
			],
			patch: [
				schemaHooks.validateData(tenantOwnerPatchValidator),
				schemaHooks.resolveData(tenantOwnerPatchResolver)
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
		tenantOwners: TenantOwnerService
	}
}
