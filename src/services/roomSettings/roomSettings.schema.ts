// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { StringEnum, Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import type { RoomSettingsService } from './roomSettings.class';
import { userSchema } from '../users/users.schema';

export const VideoCodec = StringEnum([ 'vp8', 'vp9', 'h264', 'h265', 'av1' ]);
export const VideoResolution = StringEnum([ 'low', 'medium', 'high', 'veryhigh', 'ultra' ]);

// Main data model schema
export const roomSettingsSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.Optional(Type.String()),
		description: Type.Optional(Type.String()),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
		tenantId: Type.Optional(Type.Number()),
		owner: Type.Optional(Type.Ref(userSchema)), // User owner
		ownerId: Type.Optional(Type.Number()), // User ID of the owner

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
	{ $id: 'RoomSettings', additionalProperties: false }
);
export type RoomSettings = Static<typeof roomSettingsSchema>
export const roomSettingsValidator = getValidator(roomSettingsSchema, dataValidator);
export const roomSettingsResolver = resolve<RoomSettings, HookContext<RoomSettingsService>>({
	owner: virtual(async (roomSettings, context) => {
		if (roomSettings.ownerId)
			return await context.app.service('users').get(roomSettings.ownerId);
	})
});

export const roomSettingsExternalResolver = resolve<RoomSettings, HookContext<RoomSettingsService>>({
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
export const roomSettingsDataSchema = Type.Partial(roomSettingsSchema, {
	$id: 'RoomSettingsData'
});
export type RoomSettingsData = Static<typeof roomSettingsDataSchema>
export const roomSettingsDataValidator = getValidator(roomSettingsDataSchema, dataValidator);
export const roomSettingsDataResolver = resolve<RoomSettings, HookContext<RoomSettingsService>>({
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	ownerId: async (_value, _room, context) => context.params.user?.id,
	tenantId: async (_value, _room, context) => context.params.user?.tenantId,

	maxActiveVideos: async (value = 12) => value,
	locked: async (value = true) => value,
	breakoutsEnabled: async (value = true) => value,
	chatEnabled: async (value = true) => value,
	raiseHandEnabled: async (value = true) => value,
	filesharingEnabled: async (value = true) => value,
	localRecordingEnabled: async (value = true) => value,
});

// Schema for updating existing entries
export const roomSettingsPatchSchema = Type.Partial(Type.Omit(
	roomSettingsSchema,
	[
		'id',
		'createdAt',
		'updatedAt',
		'tenantId',
		'owner',
		'ownerId',
	]), {
	$id: 'RoomSettingsPatch'
});
export type RoomSettingsPatch = Static<typeof roomSettingsPatchSchema>
export const roomSettingsPatchValidator = getValidator(roomSettingsPatchSchema, dataValidator);
export const roomSettingsPatchResolver = resolve<RoomSettings, HookContext<RoomSettingsService>>({
	updatedAt: async () => Date.now()
});

// Schema for allowed query properties
export const roomSettingsQueryProperties = Type.Pick(roomSettingsSchema, [ 'id', 'tenantId', 'ownerId' ]);
export const roomSettingsQuerySchema = Type.Intersect(
	[
		querySyntax(roomSettingsQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RoomSettingsQuery = Static<typeof roomSettingsQuerySchema>
export const roomSettingsQueryValidator = getValidator(roomSettingsQuerySchema, queryValidator);
export const roomSettingsQueryResolver = resolve<RoomSettingsQuery, HookContext<RoomSettingsService>>({
	tenantId: async (value, _query, context) => {
		if (context.params.user?.tenantId)
			return context.params.user.tenantId;

		return value;
	},
	ownerId: async (value, _query, context) => {
		if (context.params.user?.id && !context.params.user?.tenantAdmin)
			return context.params.user.id;

		return value;
	}
});
