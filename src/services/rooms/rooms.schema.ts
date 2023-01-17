// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { CoHost } from '../coHosts/coHosts.schema';

// Main data model schema
export const roomSchema = Type.Object(
	{
		id: Type.Number(),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
		name: Type.String(),
		description: Type.String(),
		background: Type.Optional(Type.String()),
		logo: Type.Optional(Type.String()),
		locked: Type.Boolean(),
		activateOnHostJoin: Type.Boolean(),
		chatEnabled: Type.Boolean(),
		raiseHandEnabled: Type.Boolean(),
		filesharingEnabled: Type.Boolean(),
		autoGainControlEnabled: Type.Boolean(),
		echoCancellationEnabled: Type.Boolean(),
		noiseSuppressionEnabled: Type.Boolean(),
		localRecordingEnabled: Type.Boolean(),
		maxActiveVideos: Type.Number(),
		aspectRatio: Type.String(),
		videoResolution: Type.String(),
		videoFrameRate: Type.Number(),
		screenShareResolution: Type.String(),
		screenShareFrameRate: Type.Number(),
		sampleRate: Type.Number(),
		channelCount: Type.Number(),
		sampleSize: Type.Number(),
		opusStereo: Type.Boolean(),
		opusDtx: Type.Boolean(),
		opusFec: Type.Boolean(),
		opusPtime: Type.Number(),
		opusMaxPlaybackRate: Type.Number(),
		personalRoom: Type.Boolean(),
		coHosts: Type.Optional(Type.Array(Type.Number())),
		roomOwnerId: Type.Number(),
		organizationId: Type.Number(),
	},
	{ $id: 'Room', additionalProperties: false }
);
export type Room = Static<typeof roomSchema>
export const roomResolver = resolve<Room, HookContext>({
	coHosts: virtual(async (room, context) => {
		const { data } = await context.app.service('coHosts').find({
			query: {
				roomId: room.id,
				$limit: 0
			}
		});

		return data.map((coHost: CoHost) => coHost.userId);
	})
});

export const roomExternalResolver = resolve<Room, HookContext>({});

// Schema for creating new entries
export const roomDataSchema = Type.Pick(
	roomSchema, [
		'name',
		'description',
	], {
		$id: 'RoomData'
	}
);
export type RoomData = Static<typeof roomDataSchema>
export const roomDataValidator = getDataValidator(roomDataSchema, dataValidator);
export const roomDataResolver = resolve<Room, HookContext>({
	name: async (value, room, context) => {
		const { total } = await context.app.service('rooms').find({
			query: {
				name: value,
				organizationId: room.organizationId,
				$limit: 0
			}
		});

		if (total > 0)
			throw new Error('Room name already exists in this organization');

		return value;
	},
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	locked: async (value = true) => value,
	activateOnHostJoin: async (value = false) => value,
	chatEnabled: async (value = true) => value,
	raiseHandEnabled: async (value = true) => value,
	filesharingEnabled: async (value = true) => value,
	autoGainControlEnabled: async (value = true) => value,
	echoCancellationEnabled: async (value = true) => value,
	noiseSuppressionEnabled: async (value = true) => value,
	localRecordingEnabled: async (value = true) => value,
	maxActiveVideos: async (value = 12) => value,
	aspectRatio: async (value = '1.778') => value,
	videoResolution: async (value = 'medium') => {
		if (![ 'low', 'medium', 'high', 'veryhigh', 'ultra' ].includes(value)) {
			throw new Error('Invalid video resolution');
		}

		return value;
	},
	videoFrameRate: async (value = 30) => value,
	screenShareResolution: async (value = 'veryhigh') => {
		if (![ 'low', 'medium', 'high', 'veryhigh', 'ultra' ].includes(value)) {
			throw new Error('Invalid screen share resolution');
		}

		return value;
	},
	screenShareFrameRate: async (value = 30) => value,
	sampleRate: async (value = 48000) => value,
	channelCount: async (value = 2) => value,
	sampleSize: async (value = 16) => value,
	opusStereo: async (value = true) => value,
	opusDtx: async (value = true) => value,
	opusFec: async (value = true) => value,
	opusPtime: async (value = 20) => value,
	opusMaxPlaybackRate: async (value = 48000) => value,
	personalRoom: async (value = true) => value,
	roomOwnerId: async (value, room, context) => context.params.user.id,
	organizationId: async (value, room, context) => context.params.user.organizationId
});

// Schema for updating existing entries
export const roomPatchSchema = Type.Partial(roomDataSchema, {
	$id: 'RoomPatch'
});
export type RoomPatch = Static<typeof roomPatchSchema>
export const roomPatchValidator = getDataValidator(roomPatchSchema, dataValidator);
export const roomPatchResolver = resolve<Room, HookContext>({
	updatedAt: async () => {
		// Return the current date
		return Date.now();
	}
});

// Schema for allowed query properties
export const roomQueryProperties = Type.Pick(roomSchema, [ 'id', 'organizationId', 'name', 'roomOwnerId' ]);
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
	organizationId: async (value, query, context) => {
		// Make sure the user is limited to their own organization
		if (context.params.user)
			return context.params.user.organizationId;

		return value;
	}
});
