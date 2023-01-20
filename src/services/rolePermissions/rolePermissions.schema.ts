// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { permissionSchema } from '../permissions/permissions.schema';

// Main data model schema
export const rolePermissionSchema = Type.Object(
	{
		id: Type.Number(),
		roleId: Type.Number(),
		permissionId: Type.Number(),
		permission: Type.Ref(permissionSchema),
	},
	{ $id: 'RolePermission', additionalProperties: false }
);
export type RolePermission = Static<typeof rolePermissionSchema>
export const rolePermissionResolver = resolve<RolePermission, HookContext>({
	permission: virtual(async (rolePermission, context) => {
		return await context.app.service('permissions').get(rolePermission.permissionId);
	}),
});

export const rolePermissionExternalResolver = resolve<RolePermission, HookContext>({});

// Schema for creating new entries
export const rolePermissionDataSchema = Type.Pick(rolePermissionSchema, [ 'roleId', 'permissionId' ], {
	$id: 'RolePermissionData'
});
export type RolePermissionData = Static<typeof rolePermissionDataSchema>
export const rolePermissionDataValidator = getDataValidator(rolePermissionDataSchema, dataValidator);
export const rolePermissionDataResolver = resolve<RolePermission, HookContext>({});

// Schema for updating existing entries
export const rolePermissionPatchSchema = Type.Partial(rolePermissionDataSchema, {
	$id: 'RolePermissionPatch'
});
export type RolePermissionPatch = Static<typeof rolePermissionPatchSchema>
export const rolePermissionPatchValidator = getDataValidator(rolePermissionPatchSchema, dataValidator);
export const rolePermissionPatchResolver = resolve<RolePermission, HookContext>({});

// Schema for allowed query properties
export const rolePermissionQueryProperties = Type.Pick(rolePermissionSchema, [ 'id', 'roleId' ]);
export const rolePermissionQuerySchema = Type.Intersect(
	[
		querySyntax(rolePermissionQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RolePermissionQuery = Static<typeof rolePermissionQuerySchema>
export const rolePermissionQueryValidator = getValidator(rolePermissionQuerySchema, queryValidator);
export const rolePermissionQueryResolver = resolve<RolePermissionQuery, HookContext>({
	roleId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingRole = await context.app.service('roles').get(value);

			// Make sure the role belongs to the same tenant as the user
			if (!existingRole || existingRole.tenantId !== context.params.user.tenantId)
				throw new Error('roleId is invalid');
		}

		return value;
	}
});
