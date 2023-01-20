// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const tenantOwnerSchema = Type.Object(
	{
		id: Type.Number(),
		tenantId: Type.Number(),
		userId: Type.Number(),
	},
	{ $id: 'TenantOwner', additionalProperties: false }
);
export type TenantOwner = Static<typeof tenantOwnerSchema>
export const tenantOwnerResolver = resolve<TenantOwner, HookContext>({});

export const tenantOwnerExternalResolver = resolve<TenantOwner, HookContext>({});

// Schema for creating new entries
export const tenantOwnerDataSchema = Type.Pick(tenantOwnerSchema, [ 'tenantId', 'userId' ], {
	$id: 'TenantOwnerData'
});
export type TenantOwnerData = Static<typeof tenantOwnerDataSchema>
export const tenantOwnerDataValidator = getDataValidator(tenantOwnerDataSchema, dataValidator);
export const tenantOwnerDataResolver = resolve<TenantOwner, HookContext>({});

// Schema for updating existing entries
export const tenantOwnerPatchSchema = Type.Partial(tenantOwnerDataSchema, {
	$id: 'TenantOwnerPatch'
});
export type TenantOwnerPatch = Static<typeof tenantOwnerPatchSchema>
export const tenantOwnerPatchValidator = getDataValidator(tenantOwnerPatchSchema, dataValidator);
export const tenantOwnerPatchResolver = resolve<TenantOwner, HookContext>({});

// Schema for allowed query properties
export const tenantOwnerQueryProperties = Type.Pick(tenantOwnerSchema, [ 'id', 'tenantId', 'userId' ]);
export const tenantOwnerQuerySchema = Type.Intersect(
	[
		querySyntax(tenantOwnerQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantOwnerQuery = Static<typeof tenantOwnerQuerySchema>
export const tenantOwnerQueryValidator = getValidator(tenantOwnerQuerySchema, queryValidator);
export const tenantOwnerQueryResolver = resolve<TenantOwnerQuery, HookContext>({
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
