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
import { tenantOAuthPath, tenantOAuthMethods } from './tenantOAuths.shared';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { pinTenantToCaller } from '../../hooks/pinTenantToCaller';
import { notInSameTenantByContextId } from '../../hooks/notSameTenant';
import { rememberOAuthTenants, reloadTenantOAuth } from '../../hooks/dynamicOAuth';
import { checkOAuthUrls } from '../../auth/oauthEgress';

export * from './tenantOAuths.class';
export * from './tenantOAuths.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const tenantOAuth = (app: Application) => {
	// Register our service on the Feathers application
	app.use(tenantOAuthPath, new TenantOAuthService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: tenantOAuthMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(tenantOAuthPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantOAuthExternalResolver),
				schemaHooks.resolveResult(tenantOAuthResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantOAuthQueryValidator),
				iff(notSuperAdmin(), isTenantAdmin, schemaHooks.resolveQuery(tenantOAuthQueryResolver))
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(tenantOAuthDataValidator),
				checkOAuthUrls,
				// a tenant admin may only configure the login of their own tenant
				iff(notSuperAdmin(), pinTenantToCaller),
				schemaHooks.resolveData(tenantOAuthDataResolver)
			],
			patch: [
				schemaHooks.validateData(tenantOAuthPatchValidator),
				checkOAuthUrls,
				iff(notSuperAdmin(), pinTenantToCaller),
				schemaHooks.resolveData(tenantOAuthPatchResolver),
				rememberOAuthTenants
			],
			remove: [
				// protect this as well
				// iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenantByContextId),
				// after the permission checks
				rememberOAuthTenants
			]
		},
		after: {
			all: [],
			// apply OAuth changes right away instead of after the next restart
			create: [ reloadTenantOAuth ],
			patch: [ reloadTenantOAuth ],
			remove: [ reloadTenantOAuth ]
		},
		error: {
			all: []
		}
	});
};

// Add this service to the service type index
declare module '../../declarations' {
	interface ServiceTypes {
		[tenantOAuthPath]: TenantOAuthService
	}
}
