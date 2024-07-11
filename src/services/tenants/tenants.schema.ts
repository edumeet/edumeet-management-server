// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { roomSettingsSchema } from '../roomSettings/roomSettings.schema';

// Main data model schema
export const tenantSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		description: Type.Optional(Type.String()),
		defaultRoomSettingsId: Type.Optional(Type.Number()),
		defaultRoomSettings: Type.Optional(Type.Ref(roomSettingsSchema)),
	},
	{ $id: 'Tenant', additionalProperties: false }
);
export type Tenant = Static<typeof tenantSchema>
export const tenantResolver = resolve<Tenant, HookContext>({
	defaultRoomSettings: virtual(async (tenant, context) => {
		if (tenant.defaultRoomSettingsId)
			return context.app.service('roomSettings').get(tenant.defaultRoomSettingsId);
	}),
});

export const tenantExternalResolver = resolve<Tenant, HookContext>({});

// Schema for creating new entries
export const tenantDataSchema = Type.Pick(tenantSchema, [ 'name', 'description' ], {
	$id: 'TenantData'
});
export type TenantData = Static<typeof tenantDataSchema>
export const tenantDataValidator = getValidator(tenantDataSchema, dataValidator);
export const tenantDataResolver = resolve<Tenant, HookContext>({});

// Schema for updating existing entries
export const tenantPatchSchema = Type.Partial(tenantDataSchema, {
	$id: 'TenantPatch'
});
export type TenantPatch = Static<typeof tenantPatchSchema>
export const tenantPatchValidator = getValidator(tenantPatchSchema, dataValidator);
export const tenantPatchResolver = resolve<Tenant, HookContext>({});

// Schema for allowed query properties
export const tenantQueryProperties = Type.Pick(tenantSchema, [ 'id', 'name' ]);
export const tenantQuerySchema = Type.Intersect(
	[
		querySyntax(tenantQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantQuery = Static<typeof tenantQuerySchema>
export const tenantQueryValidator = getValidator(tenantQuerySchema, queryValidator);
export const tenantQueryResolver = resolve<TenantQuery, HookContext>({
	id: async (value, query, context) => {
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});
