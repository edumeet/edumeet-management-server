// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantDataValidator,
	tenantPatchValidator,
	tenantQueryValidator,
	tenantResolver,
	tenantExternalResolver,
	tenantDataResolver,
	tenantPatchResolver,
	tenantQueryResolver
} from './tenants.schema';

import type { Application } from '../../declarations';
import { TenantService, getOptions } from './tenants.class';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { checkPermissions } from '../../hooks/checkPermissions';

export * from './tenants.class';
export * from './tenants.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenant = (app: Application) => {
	// Register our service on the Feathers application
	app.use('tenants', new TenantService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('tenants').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantExternalResolver),
				schemaHooks.resolveResult(tenantResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(tenantQueryResolver))
			],
			find: [],
			get: [],
			create: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				schemaHooks.validateData(tenantDataValidator),
				schemaHooks.resolveData(tenantDataResolver)
			],
			patch: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				schemaHooks.validateData(tenantPatchValidator),
				schemaHooks.resolveData(tenantPatchResolver)
			],
			remove: [ checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }) ]
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
		tenants: TenantService
	}
}
