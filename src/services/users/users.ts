// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	userQueryValidator,
	userResolver,
	userExternalResolver,
	userDataResolver,
	userPatchResolver,
	userQueryResolver,
	userDataAdminValidator,
	userPatchAdminValidator
} from './users.schema';

import type { Application } from '../../declarations';
import { UserService, getOptions } from './users.class';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { checkPermissions } from '../../hooks/checkPermissions';

export * from './users.class';
export * from './users.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const user = (app: Application) => {
	// Register our service on the Feathers application
	app.use('users', new UserService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: [ 'find', 'get', 'create', 'patch', 'remove' ],
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service('users').hooks({
		around: {
			all: [ schemaHooks.resolveExternal(userExternalResolver), schemaHooks.resolveResult(userResolver) ],
			find: [ authenticate('jwt') ],
			get: [ authenticate('jwt') ],
			create: [ authenticate('jwt') ],
			update: [ authenticate('jwt') ],
			patch: [ authenticate('jwt') ],
			remove: [ authenticate('jwt') ]
		},
		before: {
			all: [ schemaHooks.validateQuery(userQueryValidator), iff(notSuperAdmin(), schemaHooks.resolveQuery(userQueryResolver)) ],
			find: [],
			get: [],
			create: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				schemaHooks.validateData(userDataAdminValidator),
				schemaHooks.resolveData(userDataResolver)
			],
			patch: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				schemaHooks.validateData(userPatchAdminValidator),
				schemaHooks.resolveData(userPatchResolver)
			],
			remove: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] })
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
		users: UserService
	}
}
