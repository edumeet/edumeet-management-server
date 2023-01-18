// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const organizationOwnerSchema = Type.Object(
	{
		id: Type.Number(),
		organizationId: Type.Number(),
		userId: Type.Number(),
	},
	{ $id: 'OrganizationOwner', additionalProperties: false }
);
export type OrganizationOwner = Static<typeof organizationOwnerSchema>
export const organizationOwnerResolver = resolve<OrganizationOwner, HookContext>({});

export const organizationOwnerExternalResolver = resolve<OrganizationOwner, HookContext>({});

// Schema for creating new entries
export const organizationOwnerDataSchema = Type.Pick(organizationOwnerSchema, [ 'organizationId', 'userId' ], {
	$id: 'OrganizationOwnerData'
});
export type OrganizationOwnerData = Static<typeof organizationOwnerDataSchema>
export const organizationOwnerDataValidator = getDataValidator(organizationOwnerDataSchema, dataValidator);
export const organizationOwnerDataResolver = resolve<OrganizationOwner, HookContext>({});

// Schema for updating existing entries
export const organizationOwnerPatchSchema = Type.Partial(organizationOwnerDataSchema, {
	$id: 'OrganizationOwnerPatch'
});
export type OrganizationOwnerPatch = Static<typeof organizationOwnerPatchSchema>
export const organizationOwnerPatchValidator = getDataValidator(organizationOwnerPatchSchema, dataValidator);
export const organizationOwnerPatchResolver = resolve<OrganizationOwner, HookContext>({});

// Schema for allowed query properties
export const organizationOwnerQueryProperties = Type.Pick(organizationOwnerSchema, [ 'id', 'organizationId', 'userId' ]);
export const organizationOwnerQuerySchema = Type.Intersect(
	[
		querySyntax(organizationOwnerQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type OrganizationOwnerQuery = Static<typeof organizationOwnerQuerySchema>
export const organizationOwnerQueryValidator = getValidator(organizationOwnerQuerySchema, queryValidator);
export const organizationOwnerQueryResolver = resolve<OrganizationOwnerQuery, HookContext>({
	organizationId: async (value, query, context) => {
		// Make sure the user is limited to their own organization
		if (context.params.user)
			return context.params.user.organizationId;

		return value;
	},
	userId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingUser = await context.app.service('users').get(value);

			// Make sure the user belongs to the same organization as the user
			if (!existingUser || existingUser.organizationId !== context.params.user.organizationId)
				throw new Error('userId is invalid');
		}

		return value;
	},
});
