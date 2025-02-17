// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { permissionSchema } from '../permissions/permissions.schema';
import { RolePermission } from '../rolePermissions/rolePermissions.schema';

// Main data model schema
export const roleSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		description: Type.Optional(Type.String()),
		permissions: Type.Array(Type.Ref(permissionSchema)), // Array of permissions
		tenantId: Type.Number(),
	},
	{ $id: 'Role', additionalProperties: false }
);
export type Role = Static<typeof roleSchema>
export const roleResolver = resolve<Role, HookContext>({
	permissions: virtual(async (role, context) => {
		const data = await context.app.service('rolePermissions').find({
			paginate: false,
			query: {
				roleId: role.id
			}
		});

		return data.map((rolePermission: RolePermission) => rolePermission.permission);
	}),
});

export const roleExternalResolver = resolve<Role, HookContext>({});

// Schema for creating new entries
export const roleDataSchema = Type.Pick(roleSchema, [ 'name', 'description', 'tenantId' ], {
	$id: 'RoleData'
});
export type RoleData = Static<typeof roleDataSchema>
export const roleDataValidator = getValidator(roleDataSchema, dataValidator);
export const roleDataResolver = resolve<Role, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});

// Schema for updating existing entries
export const rolePatchSchema = Type.Partial(roleDataSchema, {
	$id: 'RolePatch'
});
export type RolePatch = Static<typeof rolePatchSchema>
export const rolePatchValidator = getValidator(rolePatchSchema, dataValidator);
export const rolePatchResolver = resolve<Role, HookContext>({});

// Schema for allowed query properties
export const roleQueryProperties = Type.Pick(roleSchema, [ 'id', 'name', 'tenantId' ]);
export const roleQuerySchema = Type.Intersect(
	[
		querySyntax(roleQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RoleQuery = Static<typeof roleQuerySchema>
export const roleQueryValidator = getValidator(roleQuerySchema, queryValidator);
export const roleQueryResolver = resolve<RoleQuery, HookContext>({
	tenantId: async (value, query, context) => {
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	},
});
