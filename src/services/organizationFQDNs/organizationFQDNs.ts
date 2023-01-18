// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	organizationFqdnDataValidator,
	organizationFqdnPatchValidator,
	organizationFqdnQueryValidator,
	organizationFqdnResolver,
	organizationFqdnExternalResolver,
	organizationFqdnDataResolver,
	organizationFqdnPatchResolver,
	organizationFqdnQueryResolver
} from './organizationFQDNs.schema';

import type { Application } from '../../declarations';
import { OrganizationFqdnService, getOptions } from './organizationFQDNs.class';

export * from './organizationFQDNs.class';
export * from './organizationFQDNs.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const organizationFqdn = (app: Application) => {
	// Register our service on the Feathers application
	app.use('organizationFQDNs', new OrganizationFqdnService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('organizationFQDNs').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(organizationFqdnExternalResolver),
				schemaHooks.resolveResult(organizationFqdnResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(organizationFqdnQueryValidator),
				schemaHooks.resolveQuery(organizationFqdnQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(organizationFqdnDataValidator),
				schemaHooks.resolveData(organizationFqdnDataResolver)
			],
			patch: [
				schemaHooks.validateData(organizationFqdnPatchValidator),
				schemaHooks.resolveData(organizationFqdnPatchResolver)
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
		organizationFQDNs: OrganizationFqdnService
	}
}
