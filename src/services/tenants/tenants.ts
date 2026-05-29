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

import type { Application, HookContext } from '../../declarations';
import { TenantService, getOptions } from './tenants.class';
import { tenantPath, tenantMethods } from './tenants.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { checkPermissions } from '../../hooks/checkPermissions';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { Forbidden } from '@feathersjs/errors';

export * from './tenants.class';
export * from './tenants.schema';

// A tenant admin may patch their OWN tenant only. The tenant record has no separate
// tenantId column — its own id IS the tenant id — so scope against context.id rather
// than a body field (which a client could omit or spoof). Super-admin / edumeet-server
// skip this via the notSuperAdmin() guard and may patch any tenant.
const ownTenantOnly = async (context: HookContext): Promise<HookContext> => {
	const user = context.params.user;

	if (user && context.id != null && parseInt(String(context.id)) !== parseInt(String(user.tenantId)))
		throw new Forbidden('You can only modify your own tenant.');

	return context;
};

// A configure function that registers the service and its hooks via `app.configure`
export const tenant = (app: Application) => {
	// Register our service on the Feathers application
	app.use(tenantPath, new TenantService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: tenantMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(tenantPath).hooks({
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
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), ownTenantOnly),
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
		[tenantPath]: TenantService
	}
}
