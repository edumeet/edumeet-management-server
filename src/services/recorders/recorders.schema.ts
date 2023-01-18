// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const recorderSchema = Type.Object(
	{
		id: Type.Number(),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
		hostname: Type.String(),
		port: Type.Number(),
		secret: Type.String(),
		locationId: Type.Number(),
	},
	{ $id: 'Recorder', additionalProperties: false }
);
export type Recorder = Static<typeof recorderSchema>
export const recorderResolver = resolve<Recorder, HookContext>({});

export const recorderExternalResolver = resolve<Recorder, HookContext>({});

// Schema for creating new entries
export const recorderDataSchema = Type.Pick(recorderSchema, [ 'hostname', 'port', 'secret', 'locationId' ], {
	$id: 'RecorderData'
});
export type RecorderData = Static<typeof recorderDataSchema>
export const recorderDataValidator = getDataValidator(recorderDataSchema, dataValidator);
export const recorderDataResolver = resolve<Recorder, HookContext>({
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	hostname: async (value, recorder, context) => {
		const { total } = await context.app.service('recorders').find({
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
export const recorderPatchSchema = Type.Partial(recorderDataSchema, {
	$id: 'RecorderPatch'
});
export type RecorderPatch = Static<typeof recorderPatchSchema>
export const recorderPatchValidator = getDataValidator(recorderPatchSchema, dataValidator);
export const recorderPatchResolver = resolve<Recorder, HookContext>({
	updatedAt: async () => Date.now()
});

// Schema for allowed query properties
export const recorderQueryProperties = Type.Pick(recorderSchema, [ 'id', 'hostname', 'locationId' ]);
export const recorderQuerySchema = Type.Intersect(
	[
		querySyntax(recorderQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RecorderQuery = Static<typeof recorderQuerySchema>
export const recorderQueryValidator = getValidator(recorderQuerySchema, queryValidator);
export const recorderQueryResolver = resolve<RecorderQuery, HookContext>({});
