// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantOAuthDataValidator,
	tenantOAuthPatchValidator,
	tenantOAuthQueryValidator,
	tenantOAuthResolver,
	tenantOAuthExternalResolver,
	tenantOAuthDataResolver,
	tenantOAuthPatchResolver,
	tenantOAuthQueryResolver
} from './tenantOAuths.schema';

import type { Application } from '../../declarations';
import { TenantOAuthService, getOptions } from './tenantOAuths.class';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';

export * from './tenantOAuths.class';
export * from './tenantOAuths.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenantOAuth = (app: Application) => {
	// Register our service on the Feathers application
	app.use('tenantOAuths', new TenantOAuthService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('tenantOAuths').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantOAuthExternalResolver),
				schemaHooks.resolveResult(tenantOAuthResolver)
			]
		},
		before: {
			all: [
				isTenantAdmin,
				schemaHooks.validateQuery(tenantOAuthQueryValidator),
				schemaHooks.resolveQuery(tenantOAuthQueryResolver)
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(tenantOAuthDataValidator),
				schemaHooks.resolveData(tenantOAuthDataResolver)
			],
			patch: [
				schemaHooks.validateData(tenantOAuthPatchValidator),
				schemaHooks.resolveData(tenantOAuthPatchResolver)
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
    tenantOAuths: TenantOAuthService
  }
}
