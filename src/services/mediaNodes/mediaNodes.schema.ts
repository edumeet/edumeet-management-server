// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import type { MediaNodesService } from './mediaNodes.class';

// Main data model schema
export const mediaNodesSchema = Type.Object(
	{
		id: Type.Number(),
		description: Type.Optional(Type.String()),
		hostname: Type.String(),
		port: Type.Number(),
		latitude: Type.Number(),
		longitude: Type.Number(),
		tenantId: Type.Optional(Type.Number()),
		shared: Type.Boolean(),
		turnHostname: Type.Optional(Type.String()),
		turnTlsPort: Type.Optional(Type.Number()),
		turnUdpPort: Type.Optional(Type.Number()),
	},
	{ $id: 'MediaNodes', additionalProperties: false }
);
export type MediaNodes = Static<typeof mediaNodesSchema>
export const mediaNodesValidator = getValidator(mediaNodesSchema, dataValidator);
export const mediaNodesResolver = resolve<MediaNodes, HookContext<MediaNodesService>>({});

export const mediaNodesExternalResolver = resolve<MediaNodes, HookContext<MediaNodesService>>({});

// Schema for creating new entries
export const mediaNodesDataSchema = Type.Intersect([
	Type.Pick(mediaNodesSchema, [
		'hostname',
		'port',
		'latitude',
		'longitude',
		'shared',
		'turnHostname',
		'turnTlsPort',
		'turnUdpPort',
	], {
		$id: 'MediaNodesData'
	}),
	Type.Optional(Type.Pick(mediaNodesSchema, [
		'description',
		'tenantId',
	], {
		$id: 'MediaNodesDataOptional'
	}))
]);
export type MediaNodesData = Static<typeof mediaNodesDataSchema>
export const mediaNodesDataValidator = getValidator(mediaNodesDataSchema, dataValidator);
export const mediaNodesDataResolver = resolve<MediaNodes, HookContext<MediaNodesService>>({});

// Schema for updating existing entries
export const mediaNodesPatchSchema = Type.Partial(mediaNodesSchema, {
	$id: 'MediaNodesPatch'
});
export type MediaNodesPatch = Static<typeof mediaNodesPatchSchema>
export const mediaNodesPatchValidator = getValidator(mediaNodesPatchSchema, dataValidator);
export const mediaNodesPatchResolver = resolve<MediaNodes, HookContext<MediaNodesService>>({});

// Schema for allowed query properties
export const mediaNodesQueryProperties = Type.Pick(mediaNodesSchema, [
	'id',
	'hostname',
	'port',
	'latitude',
	'longitude',
	'tenantId',
	'shared',
	'turnHostname',
	'turnTlsPort',
	'turnUdpPort',
]);
export const mediaNodesQuerySchema = Type.Intersect(
	[
		querySyntax(mediaNodesQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type MediaNodesQuery = Static<typeof mediaNodesQuerySchema>
export const mediaNodesQueryValidator = getValidator(mediaNodesQuerySchema, queryValidator);
export const mediaNodesQueryResolver = resolve<MediaNodesQuery, HookContext<MediaNodesService>>({
	hostname: async (value, query, context) => {
		if (typeof value === 'string' && context.params.user) {
			const existingMediaNode = await context.app.service('mediaNodes').get(value);

			if (!existingMediaNode || existingMediaNode.tenantId === context.params.user.tenantId)
				throw new Error('Media node not found');
		}

		return value;
	},
	tenantId: async (value, query, context) => {
		if (context.params.user?.tenantId) {
			return context.params.user.tenantId;
		}

		return value;
	}
});
