import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { encrypt } from '../../invites/crypto';

export const tenantInviteConfigSchema = Type.Object(
	{
		id: Type.Number(),
		tenantId: Type.Number(),
		enabled: Type.Boolean(),
		organizerAddress: Type.String(),
		organizerName: Type.Optional(Type.String()),
		smtpHost: Type.String(),
		smtpPort: Type.Number(),
		smtpSecure: Type.Boolean(),
		smtpUser: Type.String(),
		smtpPass: Type.String(),
		imapHost: Type.Optional(Type.String()),
		imapPort: Type.Optional(Type.Number()),
		imapSecure: Type.Optional(Type.Boolean()),
		imapUser: Type.Optional(Type.String()),
		imapPass: Type.Optional(Type.String()),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
	},
	{ $id: 'TenantInviteConfig', additionalProperties: false }
);
export type TenantInviteConfig = Static<typeof tenantInviteConfigSchema>
export const tenantInviteConfigResolver = resolve<TenantInviteConfig, HookContext>({});

// Only passwords are stripped from external responses. Non-admins seeing host/port/user
// is not a security concern — they can't write (isTenantAdmin blocks create/patch/remove)
// and they're limited to their own tenant by the query resolver.
export const tenantInviteConfigExternalResolver = resolve<TenantInviteConfig, HookContext>({
	smtpPass: async () => undefined,
	imapPass: async () => undefined,
});

const encryptPass = async (value: string | undefined, _data: unknown, context: HookContext): Promise<string | undefined> => {
	if (value === undefined || value === '') return undefined;
	// Trim whitespace defensively — paste operations sometimes capture a trailing
	// newline or space that silently breaks IMAP/SMTP auth (servers differ on whether
	// they tolerate it; some tolerate it for SMTP but reject for IMAP).
	const trimmed = value.trim();

	if (trimmed === '') return undefined;

	const invites = context.app.get('invites');

	if (!invites?.encryptionKey)
		throw new Error('invites.encryptionKey not configured');

	return encrypt(trimmed, invites.encryptionKey);
};

export const tenantInviteConfigDataSchema = Type.Omit(
	tenantInviteConfigSchema,
	[ 'id', 'createdAt', 'updatedAt' ],
	{ $id: 'TenantInviteConfigData', additionalProperties: false }
);
export type TenantInviteConfigData = Static<typeof tenantInviteConfigDataSchema>
export const tenantInviteConfigDataValidator = getValidator(tenantInviteConfigDataSchema, dataValidator);
export const tenantInviteConfigDataResolver = resolve<TenantInviteConfig, HookContext>({
	smtpPass: encryptPass,
	imapPass: encryptPass,
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now(),
	tenantId: async (value, _data, context) => {
		if (context.params.user?.tenantId != null)
			return parseInt(String(context.params.user.tenantId));

		return value;
	}
});

export const tenantInviteConfigPatchSchema = Type.Partial(
	Type.Omit(tenantInviteConfigSchema, [ 'id', 'tenantId', 'createdAt' ]),
	{ $id: 'TenantInviteConfigPatch' }
);
export type TenantInviteConfigPatch = Static<typeof tenantInviteConfigPatchSchema>
export const tenantInviteConfigPatchValidator = getValidator(tenantInviteConfigPatchSchema, dataValidator);
export const tenantInviteConfigPatchResolver = resolve<TenantInviteConfig, HookContext>({
	smtpPass: encryptPass,
	imapPass: encryptPass,
	updatedAt: async () => Date.now()
});

export const tenantInviteConfigQueryProperties = Type.Pick(tenantInviteConfigSchema, [ 'id', 'tenantId' ]);
export const tenantInviteConfigQuerySchema = Type.Intersect(
	[
		querySyntax(tenantInviteConfigQueryProperties),
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type TenantInviteConfigQuery = Static<typeof tenantInviteConfigQuerySchema>
export const tenantInviteConfigQueryValidator = getValidator(tenantInviteConfigQuerySchema, queryValidator);
export const tenantInviteConfigQueryResolver = resolve<TenantInviteConfigQuery, HookContext>({
	tenantId: async (value, _query, context) => {
		if (context.params.user?.tenantId != null)
			return parseInt(String(context.params.user.tenantId));

		return value;
	}
});
