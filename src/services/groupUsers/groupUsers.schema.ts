// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { groupSchema } from '../groups/groups.schema';
import { userSchema } from '../users/users.schema';

// Main data model schema
export const groupUserSchema = Type.Object(
	{
		id: Type.Number(),
		groupId: Type.Number(),
		group: Type.Ref(groupSchema),
		userId: Type.Number(),
		user: Type.Ref(userSchema),
	},
	{ $id: 'GroupUser', additionalProperties: false }
);
export type GroupUser = Static<typeof groupUserSchema>
export const groupUserResolver = resolve<GroupUser, HookContext>({});

export const groupUserExternalResolver = resolve<GroupUser, HookContext>({});

// Schema for creating new entries
export const groupUserDataSchema = Type.Pick(groupUserSchema, [ 'groupId', 'userId' ], {
	$id: 'GroupUserData'
});
export type GroupUserData = Static<typeof groupUserDataSchema>
export const groupUserDataValidator = getDataValidator(groupUserDataSchema, dataValidator);
export const groupUserDataResolver = resolve<GroupUser, HookContext>({});

// Schema for updating existing entries
export const groupUserPatchSchema = Type.Partial(groupUserDataSchema, {
	$id: 'GroupUserPatch'
});
export type GroupUserPatch = Static<typeof groupUserPatchSchema>
export const groupUserPatchValidator = getDataValidator(groupUserPatchSchema, dataValidator);
export const groupUserPatchResolver = resolve<GroupUser, HookContext>({});

// Schema for allowed query properties
export const groupUserQueryProperties = Type.Pick(groupUserSchema, [ 'id', 'groupId', 'userId' ]);
export const groupUserQuerySchema = Type.Intersect(
	[
		querySyntax(groupUserQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type GroupUserQuery = Static<typeof groupUserQuerySchema>
export const groupUserQueryValidator = getValidator(groupUserQuerySchema, queryValidator);
export const groupUserQueryResolver = resolve<GroupUserQuery, HookContext>({
	groupId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingGroup = await context.app.service('groups').get(value);

			// Make sure the group belongs to the same organization as the user
			if (!existingGroup || existingGroup.organizationId !== context.params.user.organizationId)
				throw new Error('groupId is invalid');
		}

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
