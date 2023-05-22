// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const tenantSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		description: Type.Optional(Type.String()),
	},
	{ $id: 'Tenant', additionalProperties: false }
);
export type Tenant = Static<typeof tenantSchema>
export const tenantResolver = resolve<Tenant, HookContext>({});

export const tenantExternalResolver = resolve<Tenant, HookContext>({});

// Schema for creating new entries
export const tenantDataSchema = Type.Pick(tenantSchema, [ 'name', 'description' ], {
	$id: 'TenantData'
});
export type TenantData = Static<typeof tenantDataSchema>
export const tenantDataValidator = getDataValidator(tenantDataSchema, dataValidator);
export const tenantDataResolver = resolve<Tenant, HookContext>({});

// Schema for updating existing entries
export const tenantPatchSchema = Type.Partial(tenantDataSchema, {
	$id: 'TenantPatch'
});
export type TenantPatch = Static<typeof tenantPatchSchema>
export const tenantPatchValidator = getDataValidator(tenantPatchSchema, dataValidator);
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
export const tenantQueryResolver = resolve<TenantQuery, HookContext>({});
