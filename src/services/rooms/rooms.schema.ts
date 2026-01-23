// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { StringEnum, Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { roomGroupRoleSchema } from '../roomGroupRoles/roomGroupRoles.schema';
import { roomUserRoleSchema } from '../roomUserRoles/roomUserRoles.schema';
import { roomOwnerSchema } from '../roomOwners/roomOwners.schema';
import { roleSchema } from '../roles/roles.schema';

export const VideoCodec = StringEnum([ 'vp8', 'vp9', 'h264', 'h265', 'av1' ]);
export const VideoResolution = StringEnum([ 'low', 'medium', 'high', 'veryhigh', 'ultra' ]);

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
		defaultRole: Type.Optional(Type.Ref(roleSchema)),
		defaultRoleId: Type.Optional(Type.Number()), // Default role for users without a role in this room

		// Look and feel
		logo: Type.Optional(Type.String()),
		background: Type.Optional(Type.String()),

		// Features of the room
		maxActiveVideos: Type.Number(),
		locked: Type.Boolean(),
		reactionsEnabled: Type.Boolean(),
		breakoutsEnabled: Type.Boolean(),
		chatEnabled: Type.Boolean(),
		raiseHandEnabled: Type.Boolean(),
		filesharingEnabled: Type.Boolean(),
		localRecordingEnabled: Type.Boolean(),

		// Video settings
		videoCodec: Type.Optional(Type.String()), // vp8, vp9, h264, h265, av1
		simulcast: Type.Optional(Type.Boolean()),
		videoResolution: Type.Optional(VideoResolution), // low, medium, high, veryhigh, ultra
		videoFramerate: Type.Optional(Type.Number()),

		// Audio settings
		audioCodec: Type.Optional(Type.String()), // opus, g722, pcmu, pcma, isac, ilbc, g729, speex
		autoGainControl: Type.Optional(Type.Boolean()),
		echoCancellation: Type.Optional(Type.Boolean()),
		noiseSuppression: Type.Optional(Type.Boolean()),
		sampleRate: Type.Optional(Type.Number()),
		channelCount: Type.Optional(Type.Number()),
		sampleSize: Type.Optional(Type.Number()),
		opusStereo: Type.Optional(Type.Boolean()),
		opusDtx: Type.Optional(Type.Boolean()),
		opusFec: Type.Optional(Type.Boolean()),
		opusPtime: Type.Optional(Type.Number()),
		opusMaxPlaybackRate: Type.Optional(Type.Number()),

		// Screen sharing settings
		screenSharingCodec: Type.Optional(Type.String()),
		screenSharingSimulcast: Type.Optional(Type.Boolean()),
		screenSharingResolution: Type.Optional(VideoResolution),
		screenSharingFramerate: Type.Optional(Type.Number()),
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
	defaultRole: virtual(async (room, context) => {
		if (room.defaultRoleId)
			return context.app.service('roles').get(room.defaultRoleId);
	}),
});

export const roomExternalResolver = resolve<Room, HookContext>({
	logo: async (value) => value ?? undefined,
	background: async (value) => value ?? undefined,
	videoCodec: async (value) => value ?? undefined,
	simulcast: async (value) => value ?? undefined,
	videoResolution: async (value) => value ?? undefined,
	videoFramerate: async (value) => value ?? undefined,
	audioCodec: async (value) => value ?? undefined,
	autoGainControl: async (value) => value ?? undefined,
	echoCancellation: async (value) => value ?? undefined,
	noiseSuppression: async (value) => value ?? undefined,
	sampleRate: async (value) => value ?? undefined,
	channelCount: async (value) => value ?? undefined,
	sampleSize: async (value) => value ?? undefined,
	opusStereo: async (value) => value ?? undefined,
	opusDtx: async (value) => value ?? undefined,
	opusFec: async (value) => value ?? undefined,
	opusPtime: async (value) => value ?? undefined,
	opusMaxPlaybackRate: async (value) => value ?? undefined,
	screenSharingCodec: async (value) => value ?? undefined,
	screenSharingSimulcast: async (value) => value ?? undefined,
	screenSharingResolution: async (value) => value ?? undefined,
	screenSharingFramerate: async (value) => value ?? undefined,
});

// Schema for creating new entries
export const roomDataSchema = Type.Intersect([
	Type.Pick(roomSchema, [ 'name' ], { additionalProperties: false }),
	// Add additional query properties here
	Type.Partial(Type.Omit(roomSchema, [
		'name',
		'owners',
		'groupRoles',
		'userRoles',
		'defaultRole',
		'createdAt',
		'updatedAt',
		'creatorId',
	], { additionalProperties: false }))
], { $id: 'RoomData', additionalProperties: false });

export type RoomData = Static<typeof roomDataSchema>
export const roomDataValidator = getValidator(roomDataSchema, dataValidator);
export const roomDataResolver = resolve<Room, HookContext>({
	// on room-server rooms are case insensitive
	name: async (value, room, context) => context.data.name.toLowerCase(),
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	creatorId: async (value, room, context) => context.params.user?.id,
	tenantId: async (value, room, context) => context.params.user?.tenantId,
	maxActiveVideos: async (value = 12) => value,
	locked: async (value = true) => value,
	breakoutsEnabled: async (value = true) => value,
	chatEnabled: async (value = true) => value,
	raiseHandEnabled: async (value = true) => value,
	reactionsEnabled: async (value = true) => value,
	filesharingEnabled: async (value = true) => value,
	localRecordingEnabled: async (value = true) => value,
});

// Schema for creating new entries as SUPERADMIN
// Same as roomDataSchema, but allows and requires tenantId in the payload
export const roomDataSuperAdminSchema = Type.Intersect([
	Type.Pick(roomSchema, [ 'name', 'tenantId' ], { additionalProperties: false }),
	// Allow all other fields, including tenantId
	Type.Partial(Type.Omit(roomSchema, [
		'name',
		'owners',
		'groupRoles',
		'userRoles',
		'defaultRole',
		'createdAt',
		'updatedAt',
		'creatorId',
	], { additionalProperties: false }))
], { $id: 'RoomDataSuperAdmin', additionalProperties: false });

export type RoomDataSuperAdmin = Static<typeof roomDataSuperAdminSchema>;
export const roomDataSuperAdminValidator = getValidator(roomDataSuperAdminSchema, dataValidator);
export const roomDataSuperAdminResolver = resolve<Room, HookContext>({
	// same behavior as roomDataResolver
	name: async (value, room, context) => context.data.name.toLowerCase(),
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	creatorId: async (value, room, context) => context.params.user?.id,

	// SUPERADMIN: if tenantId is provided in the body
	tenantId: async (value, room, context) => value,

	maxActiveVideos: async (value = 12) => value,
	locked: async (value = true) => value,
	breakoutsEnabled: async (value = true) => value,
	chatEnabled: async (value = true) => value,
	raiseHandEnabled: async (value = true) => value,
	reactionsEnabled: async (value = true) => value,
	filesharingEnabled: async (value = true) => value,
	localRecordingEnabled: async (value = true) => value
});

// Schema for updating existing entries
export const roomPatchSchema = Type.Partial(Type.Omit(
	roomSchema,
	[
		'name',
		'owners',
		'groupRoles',
		'userRoles',
		'defaultRole',
		'createdAt',
		'updatedAt',
		'creatorId',
		'tenantId',
	]), {
	$id: 'RoomPatch'
});
export type RoomPatch = Static<typeof roomPatchSchema>
export const roomPatchValidator = getValidator(roomPatchSchema, dataValidator);
export const roomPatchResolver = resolve<Room, HookContext>({
	updatedAt: async () => Date.now()
});

// Schema for allowed query properties
export const roomQueryProperties = Type.Pick(roomSchema, [ 'id', 'tenantId', 'name', 'creatorId' ]);
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
