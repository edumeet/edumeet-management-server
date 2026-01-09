// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	groupDataValidator,
	groupPatchValidator,
	groupQueryValidator,
	groupResolver,
	groupExternalResolver,
	groupDataResolver,
	groupPatchResolver,
	groupQueryResolver
} from './groups.schema';

import type { Application } from '../../declarations';
import { GroupService, getOptions } from './groups.class';
import { groupPath, groupMethods } from './groups.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { notInSameTenant, notInSameTenantByContextId } from '../../hooks/notSameTenant';

export * from './groups.class';
export * from './groups.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const group = (app: Application) => {
	// Register our service on the Feathers application
	app.use(groupPath, new GroupService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: groupMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(groupPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(groupExternalResolver),
				schemaHooks.resolveResult(groupResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(groupQueryValidator), iff(notSuperAdmin(), schemaHooks.resolveQuery(groupQueryResolver)) ],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(groupDataValidator),
				schemaHooks.resolveData(groupDataResolver) ],
			patch: [
				iff(notSuperAdmin(), notInSameTenant),
				schemaHooks.validateData(groupPatchValidator),
				schemaHooks.resolveData(groupPatchResolver) ],
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
		[groupPath]: GroupService
	}
}
