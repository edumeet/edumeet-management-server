// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	rolePermissionDataValidator,
	rolePermissionPatchValidator,
	rolePermissionQueryValidator,
	rolePermissionResolver,
	rolePermissionExternalResolver,
	rolePermissionDataResolver,
	rolePermissionPatchResolver,
	rolePermissionQueryResolver
} from './rolePermissions.schema';

import type { Application } from '../../declarations';
import { RolePermissionService, getOptions } from './rolePermissions.class';
import { rolePermissionPath, rolePermissionMethods } from './rolePermissions.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { roleIdTenantCheck, roleIdTenantCheckOnDelete } from '../../hooks/roleIdTenantCheck';
import { scopeToTenantByParent } from '../../hooks/scopeToTenantByParent';

export * from './rolePermissions.class';
export * from './rolePermissions.schema';

// A configure function that registers the service and its hooks via `app.configure`
export const rolePermission = (app: Application) => {
	// Register our service on the Feathers application
	app.use(rolePermissionPath, new RolePermissionService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: rolePermissionMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(rolePermissionPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(rolePermissionExternalResolver),
				schemaHooks.resolveResult(rolePermissionResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(rolePermissionQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(rolePermissionQueryResolver))
			],
			find: [ iff(notSuperAdmin(), scopeToTenantByParent({ key: 'roleId', parentService: 'roles' })) ],
			get: [ iff(notSuperAdmin(), scopeToTenantByParent({ key: 'roleId', parentService: 'roles' })) ],
			create: [
				// only a tenant admin changes what a role may do, and only in their own tenant
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), roleIdTenantCheck),
				schemaHooks.validateData(rolePermissionDataValidator),
				schemaHooks.resolveData(rolePermissionDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), roleIdTenantCheck),
				schemaHooks.validateData(rolePermissionPatchValidator),
				schemaHooks.resolveData(rolePermissionPatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), roleIdTenantCheckOnDelete),
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
		[rolePermissionPath]: RolePermissionService
	}
}
