// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const locationSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		description: Type.String(),
		latitude: Type.Number(),
		longitude: Type.Number(),
	},
	{ $id: 'Location', additionalProperties: false }
);
export type Location = Static<typeof locationSchema>
export const locationResolver = resolve<Location, HookContext>({});

export const locationExternalResolver = resolve<Location, HookContext>({});

// Schema for creating new entries
export const locationDataSchema = Type.Pick(locationSchema, [ 'name', 'latitude', 'longitude' ], {
	$id: 'LocationData'
});
export type LocationData = Static<typeof locationDataSchema>
export const locationDataValidator = getDataValidator(locationDataSchema, dataValidator);
export const locationDataResolver = resolve<Location, HookContext>({
	name: async (value, location, context) => {
		const { total } = await context.app.service('locations').find({
			query: {
				name: value,
				$limit: 0
			}
		});

		if (total > 0)
			throw new Error('Location name already exists');

		return value;
	},
});

// Schema for updating existing entries
export const locationPatchSchema = Type.Partial(locationDataSchema, {
	$id: 'LocationPatch'
});
export type LocationPatch = Static<typeof locationPatchSchema>
export const locationPatchValidator = getDataValidator(locationPatchSchema, dataValidator);
export const locationPatchResolver = resolve<Location, HookContext>({});

// Schema for allowed query properties
export const locationQueryProperties = Type.Pick(locationSchema, [ 'id', 'name' ]);
export const locationQuerySchema = Type.Intersect(
	[
		querySyntax(locationQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type LocationQuery = Static<typeof locationQuerySchema>
export const locationQueryValidator = getValidator(locationQuerySchema, queryValidator);
export const locationQueryResolver = resolve<LocationQuery, HookContext>({});
