// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';
import { hooks as schemaHooks } from '@feathersjs/schema';
import type { Paginated } from '@feathersjs/feathers';

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

import type { Application, HookContext } from '../../declarations';
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
import type { User } from './users.schema';

export * from './users.class';
export * from './users.schema';

/**
 * Result shape we are allowed to mutate for privacy filtering
 * (schema User has required email, but responses may hide it)
 */
type UserResult = Omit<User, 'email' | 'ssoId' | 'name'> & {
	password?: string;
	email?: string;
	ssoId?: string;
	name?: string;
};

const isPaginatedUsers = (result: unknown): result is Paginated<UserResult> =>
	typeof result === 'object' &&
	result !== null &&
	'data' in result &&
	Array.isArray((result as { data?: unknown }).data);

// A configure function that registers the service and its hooks via `app.configure`
export const user = (app: Application) => {
	const sanitizeUsersForPrivacy = async (context: HookContext<UserService>) => {
		const reqUser = context.params.user;

		// If no authenticated user, be conservative
		if (!reqUser) return context;

		const isSuperAdmin = !notSuperAdmin()(context);
		const canSeeAll = isSuperAdmin || reqUser.tenantAdmin || reqUser.tenantOwner;

		const sanitizeOne = (item: UserResult | undefined) => {
			if (!item) return;

			// Always remove password if present
			if ('password' in item && !isSuperAdmin) delete item.password;

			const isSelf = String(reqUser.id) === String(item.id);

			// Non-admins: hide email + ssoId + name except for their own row
			if (!canSeeAll && !isSelf) {
				item.email = undefined;
				item.ssoId = undefined;
				item.name = undefined;
			}
		};

		// Handle paginated and non-paginated responses
		if (isPaginatedUsers(context.result)) {
			context.result.data.forEach(sanitizeOne);
		} else if (Array.isArray(context.result)) {
			(context.result as UserResult[]).forEach(sanitizeOne);
		} else {
			sanitizeOne(context.result as UserResult | undefined);
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
			all: [
				schemaHooks.resolveExternal(userExternalResolver),
				schemaHooks.resolveResult(userResolver)
			],
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
				)
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
				iff(notSuperAdmin(), async (context: HookContext<UserService>) => {
					const reqUser = context.params.user;

					const isTenantManager =
						Boolean(reqUser?.tenantAdmin) ||
						Boolean(reqUser?.tenantOwner);

					const isSelf = String(context.id) === String(reqUser?.id);

					if (!isTenantManager && !isSelf) {
						throw new Forbidden('You are not allowed to edit this user');
					}

					// If tenant manager edits someone else, enforce same-tenant
					if (isTenantManager && !isSelf) {
						const target = await context.app
							.service('users')
							.get(context.id as User['id'], {
								...context.params,
								provider: undefined,
								query: {}
							});

						if (target?.tenantId != null && reqUser?.tenantId != null) {
							if (String(target.tenantId) !== String(reqUser.tenantId)) {
								throw new Forbidden('You are not allowed to edit users of another tenant');
							}
						}
					}

					// Allow only name + avatar (strip everything else)
					const { name, avatar } =
						context.data as Partial<Pick<User, 'name' | 'avatar'>>;

					const data: Partial<Pick<User, 'name' | 'avatar'>> = {};

					if (name !== undefined) data.name = name;
					if (avatar !== undefined) data.avatar = avatar;

					context.data =
						data as unknown as HookContext<UserService>['data'];

					return context;
				}),
				requireNonEmptyName,
				iff(
					notSuperAdmin(),
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
			create: []
		},
		error: {
			all: []
		}
	});
};

// Add this service to the service type index
declare module '../../declarations' {
	interface ServiceTypes {
		[userPath]: UserService;
	}
}
