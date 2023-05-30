// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	groupUserDataValidator,
	groupUserPatchValidator,
	groupUserQueryValidator,
	groupUserResolver,
	groupUserExternalResolver,
	groupUserDataResolver,
	groupUserPatchResolver,
	groupUserQueryResolver
} from './groupUsers.schema';

import type { Application } from '../../declarations';
import { GroupUserService, getOptions } from './groupUsers.class';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './groupUsers.class';
export * from './groupUsers.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const groupUser = (app: Application) => {
	// Register our service on the Feathers application
	app.use('groupUsers', new GroupUserService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('groupUsers').hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(groupUserExternalResolver),
				schemaHooks.resolveResult(groupUserResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(groupUserQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(groupUserQueryResolver))
			],
			find: [],
			get: [],
			create: [
				schemaHooks.validateData(groupUserDataValidator),
				schemaHooks.resolveData(groupUserDataResolver)
			],
			patch: [
				schemaHooks.validateData(groupUserPatchValidator),
				schemaHooks.resolveData(groupUserPatchResolver)
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
		groupUsers: GroupUserService
	}
}
