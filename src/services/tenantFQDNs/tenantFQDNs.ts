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
	tenantFqdnQueryResolver,
	tenantFqdnUserQueryResolver
} from './tenantFQDNs.schema';

import type { Application } from '../../declarations';
import { TenantFqdnService, getOptions } from './tenantFQDNs.class';
import { tenantFqdnPath, tenantFqdnMethods } from './tenantFQDNs.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { notInSameTenantByContextId } from '../../hooks/notSameTenant';

export * from './tenantFQDNs.class';
export * from './tenantFQDNs.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenantFqdn = (app: Application) => {
	// Register our service on the Feathers application
	app.use(tenantFqdnPath, new TenantFqdnService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: tenantFqdnMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(tenantFqdnPath).hooks({
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
				iff(notSuperAdmin(), schemaHooks.resolveQuery(tenantFqdnUserQueryResolver)).else(schemaHooks.resolveQuery(tenantFqdnQueryResolver))
			],
			find: [],
			get: [],
			create: [
				// A create has no context.id for the owner/admin lookup to work from; the
				// data resolver pins tenantId to the caller's tenant, so being a tenant
				// admin is the whole check.
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantFqdnDataValidator),
				schemaHooks.resolveData(tenantFqdnDataResolver)
			],
			patch: [
				// context.id is the FQDN row here, not a tenant, so the row's own tenant
				// is what the caller has to belong to.
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenantByContextId),
				schemaHooks.validateData(tenantFqdnPatchValidator),
				schemaHooks.resolveData(tenantFqdnPatchResolver)
			],
			remove: [ 
				// check tenant id as well
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenantByContextId)
			]
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
	[tenantFqdnPath]: TenantFqdnService
	}
}
