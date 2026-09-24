import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { asBotJobTypes } from '../../bots/verify';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const tenantBotCredentialSchema = Type.Object(
	{
		id: Type.Number(),
		tenantId: Type.Number(),
		label: Type.String({ minLength: 1, maxLength: 128 }),
		// SHA-256 hex of the token; hashed by the form, the token never reaches the server.
		tokenHash: Type.String({ pattern: '^[0-9a-f]{64}$' }),
		allowedIps: Type.Array(Type.String({ minLength: 1, maxLength: 64 }), { minItems: 1, maxItems: 64 }),
		enabled: Type.Optional(Type.Boolean()),
		createdAt: Type.Optional(Type.Number()),
		lastUsedAt: Type.Optional(Type.Union([ Type.Number(), Type.Null() ])),
		// A row with all three is a provider the room server can start jobs on;
		// a row with none of them is only a bot key, as before. The job types are the
		// kinds of work one bot of the provider does at once for a session.
		jobTypes: Type.Optional(Type.Union([
			Type.Array(Type.Union([ Type.Literal('recorder'), Type.Literal('transcriber'), Type.Literal('streamer') ]), { maxItems: 3 }),
			Type.Null()
		])),
		apiUrl: Type.Optional(Type.Union([ Type.String({ maxLength: 512 }), Type.Null() ])),
		// Write only: stored encrypted, never returned to a client.
		apiSecret: Type.Optional(Type.Union([ Type.String({ maxLength: 512 }), Type.Null() ])),
		hasApiSecret: Type.Optional(Type.Boolean()),
	},
	{ $id: 'TenantBotCredential', additionalProperties: false }
);
export type TenantBotCredential = Static<typeof tenantBotCredentialSchema>

// allowedIps and jobTypes sit in text columns as JSON strings on both dialects (see
// the serializeRanges and serializeJobTypes hooks), and enabled is a tinyint on MySQL.
export const tenantBotCredentialResolver = resolve<TenantBotCredential, HookContext>({
	allowedIps: virtual(async (row) => {
		const raw = row.allowedIps as unknown;

		return typeof raw === 'string' ? JSON.parse(raw) as string[] : (raw as string[] | null) ?? [];
	}),
	jobTypes: virtual(async (row) => (row.jobTypes == null ? null : asBotJobTypes(row.jobTypes))),
	enabled: virtual(async (row) => (row.enabled == null ? undefined : Boolean(row.enabled))),
	hasApiSecret: virtual(async (row) => Boolean(row.apiSecret)),
});

// The hash is written once and never needed back; verification runs server side.
export const tenantBotCredentialExternalResolver = resolve<TenantBotCredential, HookContext>({
	tokenHash: async () => undefined,
	// The provider's api key leaves the server only through the bot-providers service.
	apiSecret: async () => undefined,
});

// Schema for creating new entries
export const tenantBotCredentialDataSchema = Type.Pick(tenantBotCredentialSchema, [ 'tenantId', 'label', 'tokenHash', 'allowedIps', 'enabled', 'jobTypes', 'apiUrl', 'apiSecret' ], {
	$id: 'TenantBotCredentialData'
});
export type TenantBotCredentialData = Static<typeof tenantBotCredentialDataSchema>
export const tenantBotCredentialDataValidator = getValidator(tenantBotCredentialDataSchema, dataValidator);
export const tenantBotCredentialDataResolver = resolve<TenantBotCredential, HookContext>({
	tenantId: virtual(async (credential, context) => {
		if (context.params.user && context.params.user.tenantId != null) {
			return context.params.user.tenantId;
		} else {
			return context.data.tenantId;
		}
	}),
	createdAt: virtual(async () => Date.now()),
});

// Schema for updating existing entries: the hash is immutable, rotation is revoke and create.
export const tenantBotCredentialPatchSchema = Type.Partial(
	Type.Pick(tenantBotCredentialSchema, [ 'label', 'allowedIps', 'enabled', 'jobTypes', 'apiUrl', 'apiSecret' ]),
	{ $id: 'TenantBotCredentialPatch' }
);
export type TenantBotCredentialPatch = Static<typeof tenantBotCredentialPatchSchema>
export const tenantBotCredentialPatchValidator = getValidator(tenantBotCredentialPatchSchema, dataValidator);
export const tenantBotCredentialPatchResolver = resolve<TenantBotCredential, HookContext>({});

// Schema for allowed query properties
export const tenantBotCredentialQueryProperties = Type.Pick(tenantBotCredentialSchema, [ 'id', 'tenantId', 'enabled' ]);
export const tenantBotCredentialQuerySchema = Type.Intersect(
	[
		querySyntax(tenantBotCredentialQueryProperties),
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantBotCredentialQuery = Static<typeof tenantBotCredentialQuerySchema>
export const tenantBotCredentialQueryValidator = getValidator(tenantBotCredentialQuerySchema, queryValidator);
export const tenantBotCredentialQueryResolver = resolve<TenantBotCredentialQuery, HookContext>({});

export const tenantBotCredentialUserQueryResolver = resolve<TenantBotCredentialQuery, HookContext>({
	tenantId: async (value, query, context) => {
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});
