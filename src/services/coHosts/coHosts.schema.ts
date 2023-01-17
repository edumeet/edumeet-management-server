// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const coHostSchema = Type.Object(
	{
		id: Type.Number(),
		roomId: Type.Number(),
		userId: Type.Number(),
	},
	{ $id: 'CoHost', additionalProperties: false }
);
export type CoHost = Static<typeof coHostSchema>
export const coHostResolver = resolve<CoHost, HookContext>({});

export const coHostExternalResolver = resolve<CoHost, HookContext>({});

// Schema for creating new entries
export const coHostDataSchema = Type.Pick(coHostSchema, [ 'roomId', 'userId' ], {
	$id: 'CoHostData'
});
export type CoHostData = Static<typeof coHostDataSchema>
export const coHostDataValidator = getDataValidator(coHostDataSchema, dataValidator);
export const coHostDataResolver = resolve<CoHost, HookContext>({});

// Schema for updating existing entries
export const coHostPatchSchema = Type.Partial(coHostDataSchema, {
	$id: 'CoHostPatch'
});
export type CoHostPatch = Static<typeof coHostPatchSchema>
export const coHostPatchValidator = getDataValidator(coHostPatchSchema, dataValidator);
export const coHostPatchResolver = resolve<CoHost, HookContext>({});

// Schema for allowed query properties
export const coHostQueryProperties = Type.Pick(coHostSchema, [ 'id', 'roomId', 'userId' ]);
export const coHostQuerySchema = Type.Intersect(
	[
		querySyntax(coHostQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type CoHostQuery = Static<typeof coHostQuerySchema>
export const coHostQueryValidator = getValidator(coHostQuerySchema, queryValidator);
export const coHostQueryResolver = resolve<CoHostQuery, HookContext>({});
