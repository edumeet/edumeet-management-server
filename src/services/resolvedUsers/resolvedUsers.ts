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
import { ResolvedUserService, getOptions } from './resolvedUsers.class';
import { resolvedUserPath, resolvedUserMethods } from './resolvedUsers.shared';

export * from './resolvedUsers.class';
export * from './resolvedUsers.schema';

// A configure function that registers the service and its hooks via `app.configure`
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
			find: [],
			create: [
				// Auto-set userId from authenticated user
				async (context: HookContext<ResolvedUserService>) => {
					if (context.params.user) {
						context.data = {
							...context.data,
							userId: context.params.user.id
						};
					}

					return context;
				},
				schemaHooks.validateData(resolvedUserDataValidator),
				schemaHooks.resolveData(resolvedUserDataResolver)
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
		[resolvedUserPath]: ResolvedUserService
	}
}
