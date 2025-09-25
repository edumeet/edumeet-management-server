// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const defaultSchema = Type.Object(
	{
		id: Type.Number(),
		tenantId: Type.Number(),
		// # OVERRIDE
		// tenant limits (should require super admin)
		numberLimit: Type.Optional(Type.Number()), // (number of managed rooms that can be created by tenant), -unlimited-
		liveNumberLimit: Type.Optional(Type.Number()), // (number of managed rooms that can be created by tenant at the same time on the room server), _unlimited_
		userManagedRoomNumberLimit: Type.Optional(Type.Number()), // (number of managed rooms that can be created by a single user), _unlimited_
		managerManagedRoomNumberLimit: Type.Optional(Type.Number()), // (number of managed rooms that can be created by a single user), -unlimited- (if user-room-limit is set to 0, this would meant that only admins can create rooms)
		//  room features (if disabled here, no one will able to turn it on, if not set they will have the default behaviour)
		
		lockedManaged: Type.Optional(Type.Boolean()),
		raiseHandEnabledManaged: Type.Optional(Type.Boolean()),
		localRecordingEnabledManaged: Type.Optional(Type.Boolean()),
		lockedUnmanaged: Type.Optional(Type.Boolean()),
		raiseHandEnabledUnmanaged: Type.Optional(Type.Boolean()),
		localRecordingEnabledUnmanaged: Type.Optional(Type.Boolean()),
		lockedLock: Type.Optional(Type.Boolean()),
		raiseHandEnabledLock: Type.Optional(Type.Boolean()),
		localRecordingEnabledLock: Type.Optional(Type.Boolean()),

		chatEnabledUnmanaged: Type.Optional(Type.Boolean()),
		breakoutsEnabledUnmanaged: Type.Optional(Type.Boolean()),
		filesharingEnabledUnmanaged: Type.Optional(Type.Boolean()),
		chatEnabledManaged: Type.Optional(Type.Boolean()),
		breakoutsEnabledManaged: Type.Optional(Type.Boolean()),
		filesharingEnabledManaged: Type.Optional(Type.Boolean()),
		chatEnabledLock: Type.Optional(Type.Boolean()),
		breakoutsEnabledLock: Type.Optional(Type.Boolean()),
		filesharingEnabledLock: Type.Optional(Type.Boolean()),
		
		// room sensitive feature settings (override)
		tracker: Type.Optional(Type.String()),
		maxFileSize: Type.Optional(Type.Number()),
		background: Type.Optional(Type.String()),
		logo: Type.Optional(Type.String()),
		// # defaults
		// roleid for default role used as a fallback 
		defaultRoleId: Type.Optional(Type.Number()),
		// role that can be used as a permission limitter
		tenantPermissionLimitRole: Type.Optional(Type.Number()),

	},
	{ $id: 'Defaults', additionalProperties: false }
);
export type Default = Static<typeof defaultSchema>
export const defaultValidator = getValidator(defaultSchema, dataValidator);
export const defaultResolver = resolve<Default, HookContext>({});

export const defaultExternalResolver = resolve<Default, HookContext>({});

// Schema for creating new entries
export const defaultDataSchema = Type.Pick(defaultSchema, [
	'tenantId',
], {
	$id: 'DefaultsData'
});
export type DefaultData = Static<typeof defaultDataSchema>
export const defaultDataValidator = getValidator(defaultDataSchema, dataValidator);
export const defaultDataResolver = resolve<Default, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});

// Schema for updating existing entries
export const defaultPatchSchema = Type.Partial(defaultSchema, {
	$id: 'DefaultsPatch'
});
export type DefaultPatch = Static<typeof defaultPatchSchema>
export const defaultPatchValidator = getValidator(defaultPatchSchema, dataValidator);
export const defaultPatchResolver = resolve<Default, HookContext>({});

// Schema for allowed query properties
export const defaultQueryProperties = Type.Pick(defaultSchema, [ 'id', 'tenantId' ]);
export const defaultQuerySchema = Type.Intersect(
	[
		querySyntax(defaultQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type DefaultQuery = Static<typeof defaultQuerySchema>
export const defaultQueryValidator = getValidator(defaultQuerySchema, queryValidator);
export const defaultQueryResolver = resolve<DefaultQuery, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});
