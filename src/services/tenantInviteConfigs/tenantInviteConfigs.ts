import { authenticate } from '@feathersjs/authentication';
import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantInviteConfigDataValidator,
	tenantInviteConfigPatchValidator,
	tenantInviteConfigQueryValidator,
	tenantInviteConfigResolver,
	tenantInviteConfigExternalResolver,
	tenantInviteConfigDataResolver,
	tenantInviteConfigPatchResolver,
	tenantInviteConfigQueryResolver
} from './tenantInviteConfigs.schema';

import type { Application, HookContext } from '../../declarations';
import { TenantInviteConfigService, getOptions } from './tenantInviteConfigs.class';
import { tenantInviteConfigPath, tenantInviteConfigMethods } from './tenantInviteConfigs.shared';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { BadRequest } from '@feathersjs/errors';

export * from './tenantInviteConfigs.class';
export * from './tenantInviteConfigs.schema';

// When a tenant turns invites ON, the minimum needed to actually send is an organizer
// address + a usable SMTP account. Without this guard a config can be saved as enabled=true
// while incomplete, the Meetings UI then shows, and every dispatch silently no-ops.
// Runs BEFORE resolveData so context.data.smtpPass is still plaintext (we check whether a
// password was supplied; for patches an already-stored encrypted password counts).
const validateInviteConfigComplete = async (context: HookContext): Promise<HookContext> => {
	const data = (context.data ?? {}) as Record<string, unknown>;

	// For patch, merge incoming over the stored row so a partial update is validated as a whole.
	let existing: Record<string, unknown> = {};

	if (context.method === 'patch' && context.id != null) {
		try {
			existing = await context.app.service('tenantInviteConfigs').get(context.id, { provider: undefined }) as Record<string, unknown>;
		} catch { /* row may not exist yet — treat as empty */ }
	}
	const merged = { ...existing, ...data };

	// Only enforce completeness when the effective config is enabled.
	if (merged.enabled !== true) return context;

	const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
	const missing: string[] = [];

	if (!str(merged.organizerAddress)) missing.push('organizer address');
	if (!str(merged.smtpHost)) missing.push('SMTP host');
	if (!merged.smtpPort) missing.push('SMTP port');
	if (!str(merged.smtpUser)) missing.push('SMTP user');
	// Password is present if the incoming payload carries a non-empty one, OR a password
	// is already stored (existing.smtpPass holds ciphertext). On create, only the former.
	const incomingPass = typeof data.smtpPass === 'string' && data.smtpPass.trim() !== '';
	const storedPass = typeof existing.smtpPass === 'string' && existing.smtpPass !== '';

	if (!incomingPass && !storedPass) missing.push('SMTP password');

	// If an IMAP host is set, IMAP user + password are likewise required to be usable.
	if (str(merged.imapHost)) {
		if (!str(merged.imapUser)) missing.push('IMAP user');
		const incomingImapPass = typeof data.imapPass === 'string' && data.imapPass.trim() !== '';
		const storedImapPass = typeof existing.imapPass === 'string' && existing.imapPass !== '';

		if (!incomingImapPass && !storedImapPass) missing.push('IMAP password');
	}

	if (missing.length > 0)
		throw new BadRequest(`Cannot enable invites: missing ${missing.join(', ')}.`);

	return context;
};

export const tenantInviteConfig = (app: Application) => {
	app.use(tenantInviteConfigPath, new TenantInviteConfigService(getOptions(app)), {
		methods: tenantInviteConfigMethods,
		events: []
	});

	app.service(tenantInviteConfigPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantInviteConfigExternalResolver),
				schemaHooks.resolveResult(tenantInviteConfigResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantInviteConfigQueryValidator),
				schemaHooks.resolveQuery(tenantInviteConfigQueryResolver)
			],
			find: [],
			get: [],
			create: [
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantInviteConfigDataValidator),
				validateInviteConfigComplete,
				schemaHooks.resolveData(tenantInviteConfigDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantInviteConfigPatchValidator),
				validateInviteConfigComplete,
				schemaHooks.resolveData(tenantInviteConfigPatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), isTenantAdmin)
			]
		},
		after: {
			all: []
		},
		error: {
			all: []
		}
	});
};

declare module '../../declarations' {
	interface ServiceTypes {
		[tenantInviteConfigPath]: TenantInviteConfigService
	}
}
