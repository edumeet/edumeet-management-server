// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const tenantOAuthSchema = Type.Object(
	{
		id: Type.Number(),
		tenantId: Type.Number(),
		key: Type.String(),
		secret: Type.String(),
		// eslint-disable-next-line camelcase
		authorize_url: Type.String(),
		// eslint-disable-next-line camelcase
		access_url: Type.String(),
		// eslint-disable-next-line camelcase
		profile_url: Type.String(),
		// eslint-disable-next-line camelcase
		scope: Type.String(),
		// eslint-disable-next-line camelcase
		scope_delimiter: Type.String(),
	},
	{ $id: 'TenantOAuth', additionalProperties: false }
);
export type TenantOAuth = Static<typeof tenantOAuthSchema>
export const tenantOAuthValidator = getValidator(tenantOAuthSchema, dataValidator);
export const tenantOAuthResolver = resolve<TenantOAuth, HookContext>({});

export const tenantOAuthExternalResolver = resolve<TenantOAuth, HookContext>({
	// The key should never be visible externally
	key: async () => undefined,
	// The secret should never be visible externally
	secret: async () => undefined
});

// Schema for creating new entries
export const tenantOAuthDataSchema = Type.Omit(tenantOAuthSchema, [
	'id',
	'scope',
	'scope_delimiter'
], {
	$id: 'TenantOAuthData', additionalProperties: false
});
export type TenantOAuthData = Static<typeof tenantOAuthDataSchema>
export const tenantOAuthDataValidator = getValidator(tenantOAuthDataSchema, dataValidator);
export const tenantOAuthDataResolver = resolve<TenantOAuth, HookContext>({
	scope: async (value = 'openid profile email') => value,
	// eslint-disable-next-line camelcase
	scope_delimiter: async (value = ' ') => value,
});

// Schema for updating existing entries
export const tenantOAuthPatchSchema = Type.Partial(tenantOAuthSchema, {
	$id: 'TenantOAuthPatch'
});
export type TenantOAuthPatch = Static<typeof tenantOAuthPatchSchema>
export const tenantOAuthPatchValidator = getValidator(tenantOAuthPatchSchema, dataValidator);
export const tenantOAuthPatchResolver = resolve<TenantOAuth, HookContext>({});

// Schema for allowed query properties
export const tenantOAuthQueryProperties = Type.Pick(tenantOAuthSchema, [ 'id', 'tenantId' ]);
export const tenantOAuthQuerySchema = Type.Intersect(
	[
		querySyntax(tenantOAuthQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantOAuthQuery = Static<typeof tenantOAuthQuerySchema>
export const tenantOAuthQueryValidator = getValidator(tenantOAuthQuerySchema, queryValidator);
export const tenantOAuthQueryResolver = resolve<TenantOAuthQuery, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});