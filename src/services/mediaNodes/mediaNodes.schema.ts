// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const mediaNodeSchema = Type.Object(
	{
		id: Type.Number(),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
		hostname: Type.String(),
		port: Type.Number(),
		secret: Type.String(),
		organizationOwnerId: Type.Optional(Type.Number()),
		locationId: Type.Number(),
	},
	{ $id: 'MediaNode', additionalProperties: false }
);
export type MediaNode = Static<typeof mediaNodeSchema>
export const mediaNodeResolver = resolve<MediaNode, HookContext>({});

export const mediaNodeExternalResolver = resolve<MediaNode, HookContext>({});

// Schema for creating new entries
export const mediaNodeDataSchema = Type.Pick(mediaNodeSchema, [ 'hostname', 'port', 'secret', 'organizationOwnerId', 'locationId' ], {
	$id: 'MediaNodeData'
});
export type MediaNodeData = Static<typeof mediaNodeDataSchema>
export const mediaNodeDataValidator = getDataValidator(mediaNodeDataSchema, dataValidator);
export const mediaNodeDataResolver = resolve<MediaNode, HookContext>({
	hostname: async (value, mediaNode, context) => {
		const { total } = await context.app.service('mediaNodes').find({
			query: {
				hostname: value,
				$limit: 0
			}
		});

		if (total > 0)
			throw new Error('Media node hostname already exists');

		return value;
	}
});

// Schema for updating existing entries
export const mediaNodePatchSchema = Type.Partial(mediaNodeDataSchema, {
	$id: 'MediaNodePatch'
});
export type MediaNodePatch = Static<typeof mediaNodePatchSchema>
export const mediaNodePatchValidator = getDataValidator(mediaNodePatchSchema, dataValidator);
export const mediaNodePatchResolver = resolve<MediaNode, HookContext>({});

// Schema for allowed query properties
export const mediaNodeQueryProperties = Type.Pick(mediaNodeSchema, [ 'id', 'hostname', 'organizationOwnerId', 'locationId' ]);
export const mediaNodeQuerySchema = Type.Intersect(
	[
		querySyntax(mediaNodeQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type MediaNodeQuery = Static<typeof mediaNodeQuerySchema>
export const mediaNodeQueryValidator = getValidator(mediaNodeQuerySchema, queryValidator);
export const mediaNodeQueryResolver = resolve<MediaNodeQuery, HookContext>({});
