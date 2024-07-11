// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { roomGroupRoleSchema } from '../roomGroupRoles/roomGroupRoles.schema';
import { roomUserRoleSchema } from '../roomUserRoles/roomUserRoles.schema';
import { roomOwnerSchema } from '../roomOwners/roomOwners.schema';
import { roleSchema } from '../roles/roles.schema';
import { roomSettingsSchema } from '../roomSettings/roomSettings.schema';

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

		roomSettings: Type.Optional(Type.Ref(roomSettingsSchema)), // Room settings ID
		roomSettingsId: Type.Optional(Type.Number()), // Room settings ID
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
	roomSettings: virtual(async (room, context) => {
		if (room.roomSettingsId)
			return context.app.service('roomSettings').get(room.roomSettingsId);
		else if (room.tenantId) {
			const tenant = await context.app.service('tenants').get(room.tenantId);

			if (tenant.defaultRoomSettingsId)
				return context.app.service('roomSettings').get(tenant.defaultRoomSettingsId);
		}
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
		'defaultRole',
		'createdAt',
		'updatedAt',
		'creatorId',
		'tenantId',
		'roomSettings',
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
});

// Schema for updating existing entries
export const roomPatchSchema = Type.Partial(Type.Omit(
	roomSchema,
	[
		'id',
		'name',
		'owners',
		'groupRoles',
		'userRoles',
		'defaultRole',
		'createdAt',
		'updatedAt',
		'creatorId',
		'tenantId',
		'roomSettings',
	]), {
	$id: 'RoomPatch'
});
export type RoomPatch = Static<typeof roomPatchSchema>
export const roomPatchValidator = getValidator(roomPatchSchema, dataValidator);
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
