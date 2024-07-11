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
		lockedLogo: Type.Boolean(),
		background: Type.Optional(Type.String()),
		lockedBackground: Type.Boolean(),

		// Features of the room
		maxActiveVideos: Type.Number(),
		lockedMaxActiveVideos: Type.Boolean(),
		locked: Type.Boolean(),
		lockedLocked: Type.Boolean(),
		breakoutsEnabled: Type.Boolean(),
		lockedBreakoutsEnabled: Type.Boolean(),
		chatEnabled: Type.Boolean(),
		lockedChatEnabled: Type.Boolean(),
		raiseHandEnabled: Type.Boolean(),
		lockedRaiseHandEnabled: Type.Boolean(),
		filesharingEnabled: Type.Boolean(),
		lockedFilesharingEnabled: Type.Boolean(),
		localRecordingEnabled: Type.Boolean(),
		lockedLocalRecordingEnabled: Type.Boolean(),

		// Video settings
		videoCodec: Type.Optional(Type.String()), // vp8, vp9, h264, h265, av1
		lockedVideoCodec: Type.Boolean(),
		simulcast: Type.Optional(Type.Boolean()),
		lockedSimulcast: Type.Boolean(),
		videoResolution: Type.Optional(VideoResolution), // low, medium, high, veryhigh, ultra
		lockedVideoResolution: Type.Boolean(),
		videoFramerate: Type.Optional(Type.Number()),
		lockedVideoFramerate: Type.Boolean(),

		// Audio settings
		audioCodec: Type.Optional(Type.String()), // opus, g722, pcmu, pcma, isac, ilbc, g729, speex
		lockedAudioCodec: Type.Boolean(),
		autoGainControl: Type.Optional(Type.Boolean()),
		lockedAutoGainControl: Type.Boolean(),
		echoCancellation: Type.Optional(Type.Boolean()),
		lockedEchoCancellation: Type.Boolean(),
		noiseSuppression: Type.Optional(Type.Boolean()),
		lockedNoiseSuppression: Type.Boolean(),
		sampleRate: Type.Optional(Type.Number()),
		lockedSampleRate: Type.Boolean(),
		channelCount: Type.Optional(Type.Number()),
		lockedChannelCount: Type.Boolean(),
		sampleSize: Type.Optional(Type.Number()),
		lockedSampleSize: Type.Boolean(),
		opusStereo: Type.Optional(Type.Boolean()),
		lockedOpusStereo: Type.Boolean(),
		opusDtx: Type.Optional(Type.Boolean()),
		lockedOpusDtx: Type.Boolean(),
		opusFec: Type.Optional(Type.Boolean()),
		lockedOpusFec: Type.Boolean(),
		opusPtime: Type.Optional(Type.Number()),
		lockedOpusPtime: Type.Boolean(),
		opusMaxPlaybackRate: Type.Optional(Type.Number()),
		lockedOpusMaxPlaybackRate: Type.Boolean(),

		// Screen sharing settings
		screenSharingCodec: Type.Optional(Type.String()),
		lockedScreenSharingCodec: Type.Boolean(),
		screenSharingSimulcast: Type.Optional(Type.Boolean()),
		lockedScreenSharingSimulcast: Type.Boolean(),
		screenSharingResolution: Type.Optional(VideoResolution),
		lockedScreenSharingResolution: Type.Boolean(),
		screenSharingFramerate: Type.Optional(Type.Number()),
		lockedScreenSharingFramerate: Type.Boolean(),
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
	lockedLogo: async (value) => value ?? false,
	background: async (value) => value ?? undefined,
	lockedBackground: async (value) => value ?? false,
	videoCodec: async (value) => value ?? undefined,
	lockedVideoCodec: async (value) => value ?? false,
	simulcast: async (value) => value ?? undefined,
	lockedSimulcast: async (value) => value ?? false,
	videoResolution: async (value) => value ?? undefined,
	lockedVideoResolution: async (value) => value ?? false,
	videoFramerate: async (value) => value ?? undefined,
	lockedVideoFramerate: async (value) => value ?? false,
	audioCodec: async (value) => value ?? undefined,
	lockedAudioCodec: async (value) => value ?? false,
	autoGainControl: async (value) => value ?? undefined,
	lockedAutoGainControl: async (value) => value ?? false,
	echoCancellation: async (value) => value ?? undefined,
	lockedEchoCancellation: async (value) => value ?? false,
	noiseSuppression: async (value) => value ?? undefined,
	lockedNoiseSuppression: async (value) => value ?? false,
	sampleRate: async (value) => value ?? undefined,
	lockedSampleRate: async (value) => value ?? false,
	channelCount: async (value) => value ?? undefined,
	lockedChannelCount: async (value) => value ?? false,
	sampleSize: async (value) => value ?? undefined,
	lockedSampleSize: async (value) => value ?? false,
	opusStereo: async (value) => value ?? undefined,
	lockedOpusStereo: async (value) => value ?? false,
	opusDtx: async (value) => value ?? undefined,
	lockedOpusDtx: async (value) => value ?? false,
	opusFec: async (value) => value ?? undefined,
	lockedOpusFec: async (value) => value ?? false,
	opusPtime: async (value) => value ?? undefined,
	lockedOpusPtime: async (value) => value ?? false,
	opusMaxPlaybackRate: async (value) => value ?? undefined,
	lockedOpusMaxPlaybackRate: async (value) => value ?? false,
	screenSharingCodec: async (value) => value ?? undefined,
	lockedScreenSharingCodec: async (value) => value ?? false,
	screenSharingSimulcast: async (value) => value ?? undefined,
	lockedScreenSharingSimulcast: async (value) => value ?? false,
	screenSharingResolution: async (value) => value ?? undefined,
	lockedScreenSharingResolution: async (value) => value ?? false,
	screenSharingFramerate: async (value) => value ?? undefined,
	lockedScreenSharingFramerate: async (value) => value ?? false,
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
