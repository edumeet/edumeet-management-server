import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const resolvedUserSchema = Type.Object(
	{
		id: Type.Number(),
		userId: Type.Number(),
		resolvedUserId: Type.Number(),
	},
	{ $id: 'ResolvedUser', additionalProperties: false }
);
export type ResolvedUser = Static<typeof resolvedUserSchema>
export const resolvedUserResolver = resolve<ResolvedUser, HookContext>({});

export const resolvedUserExternalResolver = resolve<ResolvedUser, HookContext>({});

// Schema for creating new entries
export const resolvedUserDataSchema = Type.Pick(resolvedUserSchema, [ 'resolvedUserId' ], {
	$id: 'ResolvedUserData'
});
export type ResolvedUserData = Static<typeof resolvedUserDataSchema>
export const resolvedUserDataValidator = getValidator(resolvedUserDataSchema, dataValidator);
export const resolvedUserDataResolver = resolve<ResolvedUser, HookContext>({});

// Schema for updating existing entries
export const resolvedUserPatchSchema = Type.Partial(resolvedUserDataSchema, {
	$id: 'ResolvedUserPatch'
});
export type ResolvedUserPatch = Static<typeof resolvedUserPatchSchema>
export const resolvedUserPatchValidator = getValidator(resolvedUserPatchSchema, dataValidator);
export const resolvedUserPatchResolver = resolve<ResolvedUser, HookContext>({});

// Schema for allowed query properties
export const resolvedUserQueryProperties = Type.Pick(resolvedUserSchema, [ 'id', 'userId', 'resolvedUserId' ]);
export const resolvedUserQuerySchema = Type.Intersect(
	[
		querySyntax(resolvedUserQueryProperties),
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type ResolvedUserQuery = Static<typeof resolvedUserQuerySchema>
export const resolvedUserQueryValidator = getValidator(resolvedUserQuerySchema, queryValidator);
export const resolvedUserQueryResolver = resolve<ResolvedUserQuery, HookContext>({});
