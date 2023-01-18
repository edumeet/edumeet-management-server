// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const organizationAdminSchema = Type.Object(
	{
		id: Type.Number(),
		organizationId: Type.Number(),
		userId: Type.Number()
	},
	{ $id: 'OrganizationAdmin', additionalProperties: false }
);
export type OrganizationAdmin = Static<typeof organizationAdminSchema>
export const organizationAdminResolver = resolve<OrganizationAdmin, HookContext>({});

export const organizationAdminExternalResolver = resolve<OrganizationAdmin, HookContext>({});

// Schema for creating new entries
export const organizationAdminDataSchema = Type.Pick(organizationAdminSchema, [ 'organizationId', 'userId' ], {
	$id: 'OrganizationAdminData'
});
export type OrganizationAdminData = Static<typeof organizationAdminDataSchema>
export const organizationAdminDataValidator = getDataValidator(organizationAdminDataSchema, dataValidator);
export const organizationAdminDataResolver = resolve<OrganizationAdmin, HookContext>({});

// Schema for updating existing entries
export const organizationAdminPatchSchema = Type.Partial(organizationAdminDataSchema, {
	$id: 'OrganizationAdminPatch'
});
export type OrganizationAdminPatch = Static<typeof organizationAdminPatchSchema>
export const organizationAdminPatchValidator = getDataValidator(organizationAdminPatchSchema, dataValidator);
export const organizationAdminPatchResolver = resolve<OrganizationAdmin, HookContext>({});

// Schema for allowed query properties
export const organizationAdminQueryProperties = Type.Pick(organizationAdminSchema, [ 'id', 'organizationId', 'userId' ]);
export const organizationAdminQuerySchema = Type.Intersect(
	[
		querySyntax(organizationAdminQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type OrganizationAdminQuery = Static<typeof organizationAdminQuerySchema>
export const organizationAdminQueryValidator = getValidator(organizationAdminQuerySchema, queryValidator);
export const organizationAdminQueryResolver = resolve<OrganizationAdminQuery, HookContext>({
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
