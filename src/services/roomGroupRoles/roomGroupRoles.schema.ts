// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { roleSchema } from '../roles/roles.schema';

// Main data model schema
export const roomGroupRoleSchema = Type.Object(
	{
		id: Type.Number(),
		roomId: Type.Number(),
		groupId: Type.Number(),
		roleId: Type.Number(),
		role: Type.Ref(roleSchema),
	},
	{ $id: 'RoomGroupRole', additionalProperties: false }
);
export type RoomGroupRole = Static<typeof roomGroupRoleSchema>
export const roomGroupRoleResolver = resolve<RoomGroupRole, HookContext>({
	role: virtual(async (roomGroupRole, context) => {
		return context.app.service('roles').get(roomGroupRole.roleId);
	}),
});

export const roomGroupRoleExternalResolver = resolve<RoomGroupRole, HookContext>({});

// Schema for creating new entries
export const roomGroupRoleDataSchema = Type.Pick(roomGroupRoleSchema, [ 'roomId', 'groupId', 'roleId' ], {
	$id: 'RoomGroupRoleData'
});
export type RoomGroupRoleData = Static<typeof roomGroupRoleDataSchema>
export const roomGroupRoleDataValidator = getValidator(roomGroupRoleDataSchema, dataValidator);
export const roomGroupRoleDataResolver = resolve<RoomGroupRole, HookContext>({});

// Schema for updating existing entries
export const roomGroupRolePatchSchema = Type.Partial(roomGroupRoleDataSchema, {
	$id: 'RoomGroupRolePatch'
});
export type RoomGroupRolePatch = Static<typeof roomGroupRolePatchSchema>
export const roomGroupRolePatchValidator = getValidator(roomGroupRolePatchSchema, dataValidator);
export const roomGroupRolePatchResolver = resolve<RoomGroupRole, HookContext>({});

// Schema for allowed query properties
export const roomGroupRoleQueryProperties = Type.Pick(roomGroupRoleSchema, [ 'id', 'roomId', 'groupId', 'roleId' ]);
export const roomGroupRoleQuerySchema = Type.Intersect(
	[
		querySyntax(roomGroupRoleQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RoomGroupRoleQuery = Static<typeof roomGroupRoleQuerySchema>
export const roomGroupRoleQueryValidator = getValidator(roomGroupRoleQuerySchema, queryValidator);
export const roomGroupRoleQueryResolver = resolve<RoomGroupRoleQuery, HookContext>({
	roomId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingRoom = await context.app.service('rooms').get(value);

			// Make sure the room belongs to the same tenant as the user
			if (!existingRoom || existingRoom.tenantId !== context.params.user.tenantId)
				throw new Error('roomId is invalid');
		}

		return value;
	},
	groupId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingGroup = await context.app.service('groups').get(value);

			// Make sure the group belongs to the same tenant as the user
			if (!existingGroup || existingGroup.tenantId !== context.params.user.tenantId)
				throw new Error('groupId is invalid');
		}

		return value;
	},
	roleId: async (value, query, context) => {
		if (typeof value === 'number' && context.params.user) {
			const existingRole = await context.app.service('roles').get(value);

			// Make sure the role belongs to the same tenant as the user
			if (!existingRole || existingRole.tenantId !== context.params.user.tenantId)
				throw new Error('roleId is invalid');
		}

		return value;
	}
});
