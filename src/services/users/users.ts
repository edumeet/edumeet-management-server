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
	userPatchValidator,
	userDataAdminValidator,
	userPatchAdminValidator,
	userTenantManagerQueryResolver
} from './users.schema';

import type { Application } from '../../declarations';
import { UserService, getOptions } from './users.class';
import { userPath, userMethods } from './users.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { notTenantManager } from '../../hooks/notTenantManager';

import { checkPermissions } from '../../hooks/checkPermissions';
import { assertRules } from '../../hooks/assertRules';
import { gainRules } from '../../hooks/gainRules';

import { Forbidden } from '@feathersjs/errors';

import { requireNonEmptyName } from '../../hooks/requireNonEmptyName';

export * from './users.class';
export * from './users.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const user = (app: Application) => {
	const sanitizeUsersForPrivacy = async (context: any) => {
		const reqUser = context.params.user as any;

		// If no authenticated user, be conservative
		if (!reqUser) return context;
	
		const canSeeAll = !!reqUser.tenantAdmin || !!reqUser.tenantOwner || !!reqUser.superAdmin;
	
		const sanitizeOne = (item: any) => {
			if (!item) return;

			// Always remove password if present
			if ('password' in item) delete item.password;

			const isSelf = String(reqUser.id) === String(item.id);

			// Non-admins: hide email + ssoId except for their own row
			if (!canSeeAll && !isSelf) {
				item.email = null;
				item.ssoId = null;
			}
		};

		// Handle paginated and non-paginated responses
		if (context.result && Array.isArray(context.result.data)) {
			context.result.data.forEach(sanitizeOne);
		} else {
			sanitizeOne(context.result);
		}

		return context;
	};

	// Register our service on the Feathers application
	app.use(userPath, new UserService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: userMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(userPath).hooks({
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
			all: [
				schemaHooks.validateQuery(userQueryValidator),
				iff(
					notSuperAdmin(),
					iff(
						notTenantManager(),
						schemaHooks.resolveQuery(userQueryResolver)
					).else(
						schemaHooks.resolveQuery(userTenantManagerQueryResolver)
					)
				),
			],
			find: [],
			get: [],
			create: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }),
				assertRules,
				schemaHooks.validateData(userDataAdminValidator),
				schemaHooks.resolveData(userDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), async (context) => {
					const user = context.params.user as any;

					const isTenantManager = !!user?.tenantAdmin || !!user?.tenantOwner;
					const isSelf = String(context.id) === String(user?.id);

					if (!isTenantManager && !isSelf) {
						throw new Forbidden('You are not allowed to edit this user');
					}

					// If tenant manager edits someone else, enforce same-tenant
					if (isTenantManager && !isSelf) {
						const target = await context.app.service('users').get(context.id as any, {
							...context.params,
							provider: undefined,
							query: {}
						});

						if (target?.tenantId != null && user?.tenantId != null) {
							if (String(target.tenantId) !== String(user.tenantId)) {
								throw new Forbidden('You are not allowed to edit users of another tenant');
							}
						}
					}

					// Allow only name + avatar (strip everything else)
					const { name, avatar } = context.data as any;
			
					context.data = {};
			
					if (name !== undefined) (context.data as any).name = name;
					if (avatar !== undefined) (context.data as any).avatar = avatar;
			
					return context;
				}),
				requireNonEmptyName,
				iff(notSuperAdmin(),
					schemaHooks.validateData(userPatchValidator)
				).else(
					schemaHooks.validateData(userPatchAdminValidator)
				),
				schemaHooks.resolveData(userPatchResolver)
			],
			remove: [
				checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] })
			]
		},
		after: {
			all: [ gainRules, sanitizeUsersForPrivacy ],
			create: [ ]
		},
		error: {
			all: []
		}
	});
};

// Add this service to the service type index
declare module '../../declarations' {
	interface ServiceTypes {
		[userPath]: UserService
	}
}
