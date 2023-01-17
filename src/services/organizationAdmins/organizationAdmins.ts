// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	organizationAdminDataValidator,
	organizationAdminPatchValidator,
	organizationAdminQueryValidator,
	organizationAdminResolver,
	organizationAdminExternalResolver,
	organizationAdminDataResolver,
	organizationAdminPatchResolver,
	organizationAdminQueryResolver
} from './organizationAdmins.schema';

import type { Application } from '../../declarations';
import { OrganizationAdminService, getOptions } from './organizationAdmins.class';

export * from './organizationAdmins.class';
export * from './organizationAdmins.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const organizationAdmin = (app: Application) => {
	// Register our service on the Feathers application
	app.use('organizationAdmins', new OrganizationAdminService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('organizationAdmins').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(organizationAdminExternalResolver),
				schemaHooks.resolveResult(organizationAdminResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(organizationAdminQueryValidator),
				schemaHooks.resolveQuery(organizationAdminQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(organizationAdminDataValidator),
				schemaHooks.resolveData(organizationAdminDataResolver)
			],
			patch: [
				schemaHooks.validateData(organizationAdminPatchValidator),
				schemaHooks.resolveData(organizationAdminPatchResolver)
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
		organizationAdmins: OrganizationAdminService
	}
}
