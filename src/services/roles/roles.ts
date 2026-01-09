// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	roleDataValidator,
	rolePatchValidator,
	roleQueryValidator,
	roleResolver,
	roleExternalResolver,
	roleDataResolver,
	rolePatchResolver,
	roleQueryResolver
} from './roles.schema';

import type { Application } from '../../declarations';
import { RoleService, getOptions } from './roles.class';
import { rolePath, roleMethods } from './roles.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { notInSameTenant, notInSameTenantByContextId } from '../../hooks/notSameTenant';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';

export * from './roles.class';
export * from './roles.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const role = (app: Application) => {
	// Register our service on the Feathers application
	app.use(rolePath, new RoleService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: roleMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(rolePath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(roleExternalResolver),
				schemaHooks.resolveResult(roleResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(roleQueryValidator), iff(notSuperAdmin(), schemaHooks.resolveQuery(roleQueryResolver)) ],
			find: [],
			get: [],
			create: [ 
				iff(notSuperAdmin(), isTenantAdmin),
				// iff(notSuperAdmin(), notInSameTenant),
				schemaHooks.validateData(roleDataValidator),
				schemaHooks.resolveData(roleDataResolver)
			],
			patch: [ 
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenant),
				schemaHooks.validateData(rolePatchValidator),
				schemaHooks.resolveData(rolePatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), isTenantAdmin),
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
		[rolePath]: RoleService
	}
}
