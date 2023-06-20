// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const tenantAdminSchema = Type.Object(
	{
		id: Type.Number(),
		tenantId: Type.Number(),
		userId: Type.Number()
	},
	{ $id: 'TenantAdmin', additionalProperties: false }
);
export type TenantAdmin = Static<typeof tenantAdminSchema>
export const tenantAdminResolver = resolve<TenantAdmin, HookContext>({});

export const tenantAdminExternalResolver = resolve<TenantAdmin, HookContext>({});

// Schema for creating new entries
export const tenantAdminDataSchema = Type.Pick(tenantAdminSchema, [ 'tenantId', 'userId' ], {
	$id: 'TenantAdminData'
});
export type TenantAdminData = Static<typeof tenantAdminDataSchema>
export const tenantAdminDataValidator = getValidator(tenantAdminDataSchema, dataValidator);
export const tenantAdminDataResolver = resolve<TenantAdmin, HookContext>({});

// Schema for updating existing entries
export const tenantAdminPatchSchema = Type.Partial(tenantAdminDataSchema, {
	$id: 'TenantAdminPatch'
});
export type TenantAdminPatch = Static<typeof tenantAdminPatchSchema>
export const tenantAdminPatchValidator = getValidator(tenantAdminPatchSchema, dataValidator);
export const tenantAdminPatchResolver = resolve<TenantAdmin, HookContext>({});

// Schema for allowed query properties
export const tenantAdminQueryProperties = Type.Pick(tenantAdminSchema, [ 'id', 'tenantId', 'userId' ]);
export const tenantAdminQuerySchema = Type.Intersect(
	[
		querySyntax(tenantAdminQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantAdminQuery = Static<typeof tenantAdminQuerySchema>
export const tenantAdminQueryValidator = getValidator(tenantAdminQuerySchema, queryValidator);
export const tenantAdminQueryResolver = resolve<TenantAdminQuery, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	},
	userId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingUser = await context.app.service('users').get(value);

			// Make sure the user belongs to the same tenant as the user
			if (!existingUser || existingUser.tenantId !== context.params.user.tenantId)
				throw new Error('userId is invalid');
		}

		return value;
	},
});
