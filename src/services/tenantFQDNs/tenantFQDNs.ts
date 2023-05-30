// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantFqdnDataValidator,
	tenantFqdnPatchValidator,
	tenantFqdnQueryValidator,
	tenantFqdnResolver,
	tenantFqdnExternalResolver,
	tenantFqdnDataResolver,
	tenantFqdnPatchResolver,
	tenantFqdnQueryResolver
} from './tenantFQDNs.schema';

import type { Application } from '../../declarations';
import { TenantFqdnService, getOptions } from './tenantFQDNs.class';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './tenantFQDNs.class';
export * from './tenantFQDNs.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenantFqdn = (app: Application) => {
	// Register our service on the Feathers application
	app.use('tenantFQDNs', new TenantFqdnService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('tenantFQDNs').hooks({
		around: {
			all: [
				schemaHooks.resolveExternal(tenantFqdnExternalResolver),
				schemaHooks.resolveResult(tenantFqdnResolver)
			],
			find: [],
			get: [],
			create: [ authenticate('jwt') ],
			patch: [ authenticate('jwt') ],
			remove: [ authenticate('jwt') ]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantFqdnQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(tenantFqdnQueryResolver))
			],
			find: [],
			get: [],
			create: [
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantFqdnDataValidator),
				schemaHooks.resolveData(tenantFqdnDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantFqdnPatchValidator),
				schemaHooks.resolveData(tenantFqdnPatchResolver)
			],
			remove: [ iff(notSuperAdmin(), isTenantAdmin) ]
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
		tenantFQDNs: TenantFqdnService
	}
}
