// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const roomOwnerSchema = Type.Object(
	{
		id: Type.Number(),
		roomId: Type.Number(),
		userId: Type.Number(),
	},
	{ $id: 'RoomOwner', additionalProperties: false }
);
export type RoomOwner = Static<typeof roomOwnerSchema>
export const roomOwnerResolver = resolve<RoomOwner, HookContext>({});

export const roomOwnerExternalResolver = resolve<RoomOwner, HookContext>({});

// Schema for creating new entries
export const roomOwnerDataSchema = Type.Pick(roomOwnerSchema, [ 'roomId', 'userId' ], {
	$id: 'RoomOwnerData'
});
export type RoomOwnerData = Static<typeof roomOwnerDataSchema>
export const roomOwnerDataValidator = getDataValidator(roomOwnerDataSchema, dataValidator);
export const roomOwnerDataResolver = resolve<RoomOwner, HookContext>({});

// Schema for updating existing entries
export const roomOwnerPatchSchema = Type.Partial(roomOwnerDataSchema, {
	$id: 'RoomOwnerPatch'
});
export type RoomOwnerPatch = Static<typeof roomOwnerPatchSchema>
export const roomOwnerPatchValidator = getDataValidator(roomOwnerPatchSchema, dataValidator);
export const roomOwnerPatchResolver = resolve<RoomOwner, HookContext>({});

// Schema for allowed query properties
export const roomOwnerQueryProperties = Type.Pick(roomOwnerSchema, [ 'id', 'roomId', 'userId' ]);
export const roomOwnerQuerySchema = Type.Intersect(
	[
		querySyntax(roomOwnerQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RoomOwnerQuery = Static<typeof roomOwnerQuerySchema>
export const roomOwnerQueryValidator = getValidator(roomOwnerQuerySchema, queryValidator);
export const roomOwnerQueryResolver = resolve<RoomOwnerQuery, HookContext>({
	// TODO: verify that query is allowed
});
