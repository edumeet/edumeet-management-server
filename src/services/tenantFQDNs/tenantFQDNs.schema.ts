// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const tenantFqdnSchema = Type.Object(
	{
		id: Type.Number(),
		fqdn: Type.String(),
		description: Type.Optional(Type.String()),
		tenantId: Type.Number(),
	},
	{ $id: 'TenantFqdn', additionalProperties: false }
);
export type TenantFqdn = Static<typeof tenantFqdnSchema>
export const tenantFqdnResolver = resolve<TenantFqdn, HookContext>({});

export const tenantFqdnExternalResolver = resolve<TenantFqdn, HookContext>({});

// Schema for creating new entries
export const tenantFqdnDataSchema = Type.Pick(tenantFqdnSchema, [ 'fqdn', 'description', 'tenantId' ], {
	$id: 'TenantFqdnData'
});
export type TenantFqdnData = Static<typeof tenantFqdnDataSchema>
export const tenantFqdnDataValidator = getDataValidator(tenantFqdnDataSchema, dataValidator);
export const tenantFqdnDataResolver = resolve<TenantFqdn, HookContext>({
	fqdn: async (value, tenantFqdn, context) => {
		// Has to be globally unique
		const { total } = await context.app.service('tenantFQDNs').find({
			query: {
				fqdn: value
			}
		});

		if (total > 0)
			throw new Error('FQDN already exists');

		return value;
	},
});

// Schema for updating existing entries
export const tenantFqdnPatchSchema = Type.Partial(tenantFqdnDataSchema, {
	$id: 'TenantFqdnPatch'
});
export type TenantFqdnPatch = Static<typeof tenantFqdnPatchSchema>
export const tenantFqdnPatchValidator = getDataValidator(tenantFqdnPatchSchema, dataValidator);
export const tenantFqdnPatchResolver = resolve<TenantFqdn, HookContext>({});

// Schema for allowed query properties
export const tenantFqdnQueryProperties = Type.Pick(tenantFqdnSchema, [ 'id', 'fqdn', 'tenantId' ]);
export const tenantFqdnQuerySchema = Type.Intersect(
	[
		querySyntax(tenantFqdnQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantFqdnQuery = Static<typeof tenantFqdnQuerySchema>
export const tenantFqdnQueryValidator = getValidator(tenantFqdnQuerySchema, queryValidator);
export const tenantFqdnQueryResolver = resolve<TenantFqdnQuery, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});
