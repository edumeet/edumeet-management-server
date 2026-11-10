import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	resolvedUserDataValidator,
	resolvedUserQueryValidator,
	resolvedUserResolver,
	resolvedUserExternalResolver,
	resolvedUserDataResolver,
	resolvedUserQueryResolver
} from './resolvedUsers.schema';

import type { Application, HookContext } from '../../declarations';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { onlyLookedUpUsers } from '../../hooks/userLookups';
import { ResolvedUserService, getOptions } from './resolvedUsers.class';
import { resolvedUserPath, resolvedUserMethods } from './resolvedUsers.shared';

export * from './resolvedUsers.class';
export * from './resolvedUsers.schema';

// A configure function that registers the service and its hooks via `app.configure`
const ownRowsOnly = async (context: HookContext<ResolvedUserService>) => {
	if (!context.params.provider || !context.params.user) return context;
	if (!notSuperAdmin()(context)) return context;

	context.params.query = { ...context.params.query, userId: context.params.user.id };

	return context;
};

export const resolvedUser = (app: Application) => {
	// Register our service on the Feathers application
	app.use(resolvedUserPath, new ResolvedUserService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: resolvedUserMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(resolvedUserPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(resolvedUserExternalResolver),
				schemaHooks.resolveResult(resolvedUserResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(resolvedUserQueryValidator),
				schemaHooks.resolveQuery(resolvedUserQueryResolver)
			],
			// Each user sees and removes only the names they resolved themselves.
			find: [ ownRowsOnly ],
			create: [
				schemaHooks.validateData(resolvedUserDataValidator),
				schemaHooks.resolveData(resolvedUserDataResolver),
				// Auto-set userId from authenticated user (after validation)
				async (context: HookContext<ResolvedUserService>) => {
					if (context.params.user) {
						(context.data as Record<string, unknown>).userId = context.params.user.id;
					}

					return context;
				},
				onlyLookedUpUsers
			],
			remove: [ ownRowsOnly ]
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
		[resolvedUserPath]: ResolvedUserService
	}
}
