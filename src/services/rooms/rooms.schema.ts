// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { roomGroupRoleSchema } from '../roomGroupRoles/roomGroupRoles.schema';
import { roomUserRoleSchema } from '../roomUserRoles/roomUserRoles.schema';
import { roomOwnerSchema } from '../roomOwners/roomOwners.schema';

// Main data model schema
export const roomSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		description: Type.String(),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
		creatorId: Type.Number(), // User ID of the creator
		tenantId: Type.Number(),

		// Roles and permissions
		owners: Type.Array(Type.Ref(roomOwnerSchema)),
		groupRoles: Type.Array(Type.Ref(roomGroupRoleSchema)), // Group roles in this room
		userRoles: Type.Array(Type.Ref(roomUserRoleSchema)), // User roles in this room

		// Look and feel
		logo: Type.Optional(Type.String()),
		background: Type.Optional(Type.String()),

		// Features of the room
		maxActiveVideos: Type.Number(),
		locked: Type.Boolean(),
		breakoutsEnabled: Type.Boolean(),
		chatEnabled: Type.Boolean(),
		raiseHandEnabled: Type.Boolean(),
		filesharingEnabled: Type.Boolean(),
		localRecordingEnabled: Type.Boolean(),
	},
	{ $id: 'Room', additionalProperties: false }
);
export type Room = Static<typeof roomSchema>
export const roomResolver = resolve<Room, HookContext>({
	owners: virtual(async (room, context) => {
		const data = await context.app.service('roomOwners').find({
			paginate: false,
			query: {
				roomId: room.id
			}
		});

		return data;
	}),
	groupRoles: virtual(async (room, context) => {
		const data = await context.app.service('roomGroupRoles').find({
			paginate: false,
			query: {
				roomId: room.id
			}
		});

		return data;
	}),
	userRoles: virtual(async (room, context) => {
		const data = await context.app.service('roomUserRoles').find({
			paginate: false,
			query: {
				roomId: room.id
			}
		});

		return data;
	}),
});

export const roomExternalResolver = resolve<Room, HookContext>({});

// Schema for creating new entries
export const roomDataSchema = Type.Intersect([
	Type.Pick(roomSchema, [ 'name' ], { additionalProperties: false }),
	// Add additional query properties here
	Type.Partial(Type.Omit(roomSchema, [
		'name',
		'owners',
		'groupRoles',
		'userRoles',
		'createdAt',
		'updatedAt',
		'creatorId',
		'tenantId',
	], { additionalProperties: false }))
], { $id: 'RoomData', additionalProperties: false });
export type RoomData = Static<typeof roomDataSchema>
export const roomDataValidator = getDataValidator(roomDataSchema, dataValidator);
export const roomDataResolver = resolve<Room, HookContext>({
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	creatorId: async (value, room, context) => context.params.user?.id,
	tenantId: async (value, room, context) => context.params.user?.tenantId,
	maxActiveVideos: async (value = 12) => value,
	locked: async (value = true) => value,
	breakoutsEnabled: async (value = true) => value,
	chatEnabled: async (value = true) => value,
	raiseHandEnabled: async (value = true) => value,
	filesharingEnabled: async (value = true) => value,
	localRecordingEnabled: async (value = true) => value,
});

// Schema for updating existing entries
export const roomPatchSchema = Type.Partial(Type.Omit(
	roomSchema,
	[
		'name',
		'owners',
		'groupRoles',
		'userRoles',
		'createdAt',
		'updatedAt',
		'creatorId',
		'tenantId',
	]), {
	$id: 'RoomPatch'
});
export type RoomPatch = Static<typeof roomPatchSchema>
export const roomPatchValidator = getDataValidator(roomPatchSchema, dataValidator);
export const roomPatchResolver = resolve<Room, HookContext>({
	updatedAt: async () => Date.now()
});

// Schema for allowed query properties
export const roomQueryProperties = Type.Pick(roomSchema, [ 'id', 'tenantId', 'name' ]);
export const roomQuerySchema = Type.Intersect(
	[
		querySyntax(roomQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RoomQuery = Static<typeof roomQuerySchema>
export const roomQueryValidator = getValidator(roomQuerySchema, queryValidator);
export const roomQueryResolver = resolve<RoomQuery, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});
