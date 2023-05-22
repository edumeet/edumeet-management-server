// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const groupSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		description: Type.String(),
		tenantId: Type.Optional(Type.Number()),
	},
	{ $id: 'Group', additionalProperties: false }
);
export type Group = Static<typeof groupSchema>
export const groupResolver = resolve<Group, HookContext>({});

export const groupExternalResolver = resolve<Group, HookContext>({});

// Schema for creating new entries
export const groupDataSchema = Type.Pick(groupSchema, [ 'name' ], {
	$id: 'GroupData'
});
export type GroupData = Static<typeof groupDataSchema>
export const groupDataValidator = getDataValidator(groupDataSchema, dataValidator);
export const groupDataResolver = resolve<Group, HookContext>({});

// Schema for updating existing entries
export const groupPatchSchema = Type.Partial(groupDataSchema, {
	$id: 'GroupPatch'
});
export type GroupPatch = Static<typeof groupPatchSchema>
export const groupPatchValidator = getDataValidator(groupPatchSchema, dataValidator);
export const groupPatchResolver = resolve<Group, HookContext>({});

// Schema for allowed query properties
export const groupQueryProperties = Type.Pick(groupSchema, [ 'id', 'name', 'tenantId' ]);
export const groupQuerySchema = Type.Intersect(
	[
		querySyntax(groupQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type GroupQuery = Static<typeof groupQuerySchema>
export const groupQueryValidator = getValidator(groupQuerySchema, queryValidator);
export const groupQueryResolver = resolve<GroupQuery, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});
