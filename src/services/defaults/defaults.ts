// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	defaultDataValidator,
	defaultPatchValidator,
	defaultQueryValidator,
	defaultResolver,
	defaultExternalResolver,
	defaultDataResolver,
	defaultPatchResolver,
	defaultQueryResolver
} from './defaults.schema';

import type { Application } from '../../declarations';
import { DefaultService, getOptions } from './defaults.class';
import { defaultPath, defaultMethods } from './defaults.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { notInSameTenant } from '../../hooks/notSameTenant';
import { tenantDefault } from '../../hooks/tenantDefault';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { adminOnly } from '../../hooks/adminOnly';

export * from './defaults.class';
export * from './defaults.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const defaults = (app: Application) => {
	// Register our service on the Feathers application
	app.use(defaultPath, new DefaultService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: defaultMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(defaultPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(defaultExternalResolver),
				schemaHooks.resolveResult(defaultResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(defaultQueryValidator), iff(notSuperAdmin(), schemaHooks.resolveQuery(defaultQueryResolver)) ],
			find: [],
			get: [],
			create: [
				iff(notSuperAdmin(), isTenantAdmin),
				// iff(notSuperAdmin(), notInSameTenant),
				schemaHooks.validateData(defaultDataValidator),
				schemaHooks.resolveData(defaultDataResolver) ],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenant),
				iff(notSuperAdmin(), tenantDefault),
				
				schemaHooks.validateData(defaultPatchValidator),
				schemaHooks.resolveData(defaultPatchResolver) ],
			remove: [
				iff(notSuperAdmin(), adminOnly),

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
		[defaultPath]: DefaultService
	}
}
