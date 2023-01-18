// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const trackerSchema = Type.Object(
	{
		id: Type.Number(),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
		hostname: Type.String(),
		port: Type.Number(),
		secret: Type.String(),
		locationId: Type.Number(),
	},
	{ $id: 'Tracker', additionalProperties: false }
);
export type Tracker = Static<typeof trackerSchema>
export const trackerResolver = resolve<Tracker, HookContext>({});

export const trackerExternalResolver = resolve<Tracker, HookContext>({});

// Schema for creating new entries
export const trackerDataSchema = Type.Pick(trackerSchema, [ 'hostname', 'port', 'secret', 'locationId' ], {
	$id: 'TrackerData'
});
export type TrackerData = Static<typeof trackerDataSchema>
export const trackerDataValidator = getDataValidator(trackerDataSchema, dataValidator);
export const trackerDataResolver = resolve<Tracker, HookContext>({
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	hostname: async (value, tracker, context) => {
		const { total } = await context.app.service('trackers').find({
			query: {
				hostname: value
			}
		});

		if (total > 0)
			throw new Error('Media node hostname already exists');

		return value;
	}
});

// Schema for updating existing entries
export const trackerPatchSchema = Type.Partial(trackerDataSchema, {
	$id: 'TrackerPatch'
});
export type TrackerPatch = Static<typeof trackerPatchSchema>
export const trackerPatchValidator = getDataValidator(trackerPatchSchema, dataValidator);
export const trackerPatchResolver = resolve<Tracker, HookContext>({
	updatedAt: async () => Date.now()
});

// Schema for allowed query properties
export const trackerQueryProperties = Type.Pick(trackerSchema, [ 'id', 'hostname', 'locationId' ]);
export const trackerQuerySchema = Type.Intersect(
	[
		querySyntax(trackerQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TrackerQuery = Static<typeof trackerQuerySchema>
export const trackerQueryValidator = getValidator(trackerQuerySchema, queryValidator);
export const trackerQueryResolver = resolve<TrackerQuery, HookContext>({});
