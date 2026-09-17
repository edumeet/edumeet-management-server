import { authenticate } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';
import { hooks as schemaHooks } from '@feathersjs/schema';
import { iff } from 'feathers-hooks-common';

import type { Application, HookContext } from '../../declarations';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { notInSameTenantByContextId } from '../../hooks/notSameTenant';
import { invalidRanges } from '../../bots/verify';
import {
	tenantBotCredentialDataValidator,
	tenantBotCredentialPatchValidator,
	tenantBotCredentialQueryValidator,
	tenantBotCredentialResolver,
	tenantBotCredentialExternalResolver,
	tenantBotCredentialDataResolver,
	tenantBotCredentialPatchResolver,
	tenantBotCredentialQueryResolver,
	tenantBotCredentialUserQueryResolver
} from './tenantBotCredentials.schema';
import { TenantBotCredentialService, getOptions } from './tenantBotCredentials.class';
import { tenantBotCredentialPath, tenantBotCredentialMethods } from './tenantBotCredentials.shared';

export * from './tenantBotCredentials.class';
export * from './tenantBotCredentials.schema';

// The schema only knows the entries are strings; each one must be an address or a range.
export const validRanges = async (context: HookContext): Promise<HookContext> => {
	const ranges = context.data?.allowedIps;

	if (Array.isArray(ranges)) {
		const bad = invalidRanges(ranges);

		if (bad.length > 0) throw new BadRequest(`Not an IP address or range: ${bad.join(', ')}`);
	}

	return context;
};

// Runs after validation, so the column gets a JSON string the drivers agree on.
export const serializeRanges = async (context: HookContext): Promise<HookContext> => {
	if (Array.isArray(context.data?.allowedIps)) context.data.allowedIps = JSON.stringify(context.data.allowedIps);

	return context;
};

export const tenantBotCredential = (app: Application) => {
	app.use(tenantBotCredentialPath, new TenantBotCredentialService(getOptions(app)), {
		methods: tenantBotCredentialMethods,
		events: []
	});
	app.service(tenantBotCredentialPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantBotCredentialExternalResolver),
				schemaHooks.resolveResult(tenantBotCredentialResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantBotCredentialQueryValidator),
				iff(notSuperAdmin(), schemaHooks.resolveQuery(tenantBotCredentialUserQueryResolver)).else(schemaHooks.resolveQuery(tenantBotCredentialQueryResolver))
			],
			find: [],
			get: [],
			create: [
				// The data resolver pins tenantId to the caller's tenant, so being a tenant
				// admin is the whole check; a create has no context.id to look a tenant up by.
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantBotCredentialDataValidator),
				validRanges,
				schemaHooks.resolveData(tenantBotCredentialDataResolver),
				serializeRanges
			],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenantByContextId),
				schemaHooks.validateData(tenantBotCredentialPatchValidator),
				validRanges,
				schemaHooks.resolveData(tenantBotCredentialPatchResolver),
				serializeRanges
			],
			remove: [
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenantByContextId)
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
		[tenantBotCredentialPath]: TenantBotCredentialService
	}
}
