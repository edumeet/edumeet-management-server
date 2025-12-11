// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantAdminDataValidator,
	tenantAdminPatchValidator,
	tenantAdminQueryValidator,
	tenantAdminResolver,
	tenantAdminExternalResolver,
	tenantAdminDataResolver,
	tenantAdminPatchResolver,
	tenantAdminQueryResolver
} from './tenantAdmins.schema';

import type { Application } from '../../declarations';
import { TenantAdminService, getOptions } from './tenantAdmins.class';
import { tenantAdminPath, tenantAdminMethods } from './tenantAdmins.shared';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { notInSameTenantByContextId } from '../../hooks/notSameTenant';

export * from './tenantAdmins.class';
export * from './tenantAdmins.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenantAdmin = (app: Application) => {
	// Register our service on the Feathers application
	app.use(tenantAdminPath, new TenantAdminService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: tenantAdminMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(tenantAdminPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantAdminExternalResolver),
				schemaHooks.resolveResult(tenantAdminResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantAdminQueryValidator),
				iff(notSuperAdmin(), isTenantAdmin, schemaHooks.resolveQuery(tenantAdminQueryResolver))
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(tenantAdminDataValidator),
				schemaHooks.resolveData(tenantAdminDataResolver)
			],
			patch: [
				schemaHooks.validateData(tenantAdminPatchValidator),
				schemaHooks.resolveData(tenantAdminPatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), notInSameTenantByContextId),
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
		[tenantAdminPath]: TenantAdminService
	}
}
