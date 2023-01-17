// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const organizationSchema = Type.Object(
	{
		id: Type.Number(),
		text: Type.String()
	},
	{ $id: 'Organization', additionalProperties: false }
);
export type Organization = Static<typeof organizationSchema>
export const organizationResolver = resolve<Organization, HookContext>({});

export const organizationExternalResolver = resolve<Organization, HookContext>({});

// Schema for creating new entries
export const organizationDataSchema = Type.Pick(organizationSchema, [ 'text' ], {
	$id: 'OrganizationData'
});
export type OrganizationData = Static<typeof organizationDataSchema>
export const organizationDataValidator = getDataValidator(organizationDataSchema, dataValidator);
export const organizationDataResolver = resolve<Organization, HookContext>({});

// Schema for updating existing entries
export const organizationPatchSchema = Type.Partial(organizationDataSchema, {
	$id: 'OrganizationPatch'
});
export type OrganizationPatch = Static<typeof organizationPatchSchema>
export const organizationPatchValidator = getDataValidator(organizationPatchSchema, dataValidator);
export const organizationPatchResolver = resolve<Organization, HookContext>({});

// Schema for allowed query properties
export const organizationQueryProperties = Type.Pick(organizationSchema, [ 'id', 'text' ]);
export const organizationQuerySchema = Type.Intersect(
	[
		querySyntax(organizationQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type OrganizationQuery = Static<typeof organizationQuerySchema>
export const organizationQueryValidator = getValidator(organizationQuerySchema, queryValidator);
export const organizationQueryResolver = resolve<OrganizationQuery, HookContext>({});
