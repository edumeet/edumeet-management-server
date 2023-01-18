// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const organizationFqdnSchema = Type.Object(
	{
		id: Type.Number(),
		fqdn: Type.String(),
		description: Type.Optional(Type.String()),
		organizationId: Type.Number(),
	},
	{ $id: 'OrganizationFqdn', additionalProperties: false }
);
export type OrganizationFqdn = Static<typeof organizationFqdnSchema>
export const organizationFqdnResolver = resolve<OrganizationFqdn, HookContext>({});

export const organizationFqdnExternalResolver = resolve<OrganizationFqdn, HookContext>({});

// Schema for creating new entries
export const organizationFqdnDataSchema = Type.Pick(organizationFqdnSchema, [ 'fqdn', 'description', 'organizationId' ], {
	$id: 'OrganizationFqdnData'
});
export type OrganizationFqdnData = Static<typeof organizationFqdnDataSchema>
export const organizationFqdnDataValidator = getDataValidator(organizationFqdnDataSchema, dataValidator);
export const organizationFqdnDataResolver = resolve<OrganizationFqdn, HookContext>({
	fqdn: async (value, organizationFqdn, context) => {
		// Has to be globally unique
		const { total } = await context.app.service('organizationFQDNs').find({
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
export const organizationFqdnPatchSchema = Type.Partial(organizationFqdnDataSchema, {
	$id: 'OrganizationFqdnPatch'
});
export type OrganizationFqdnPatch = Static<typeof organizationFqdnPatchSchema>
export const organizationFqdnPatchValidator = getDataValidator(organizationFqdnPatchSchema, dataValidator);
export const organizationFqdnPatchResolver = resolve<OrganizationFqdn, HookContext>({});

// Schema for allowed query properties
export const organizationFqdnQueryProperties = Type.Pick(organizationFqdnSchema, [ 'id', 'fqdn', 'organizationId' ]);
export const organizationFqdnQuerySchema = Type.Intersect(
	[
		querySyntax(organizationFqdnQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type OrganizationFqdnQuery = Static<typeof organizationFqdnQuerySchema>
export const organizationFqdnQueryValidator = getValidator(organizationFqdnQuerySchema, queryValidator);
export const organizationFqdnQueryResolver = resolve<OrganizationFqdnQuery, HookContext>({
	organizationId: async (value, query, context) => {
		// Make sure the user is limited to their own organization
		if (context.params.user)
			return context.params.user.organizationId;

		return value;
	}
});
