import { authenticate } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';
import { hooks as schemaHooks } from '@feathersjs/schema';
import { iff } from 'feathers-hooks-common';

import type { Application, HookContext } from '../../declarations';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { notInSameTenantByContextId } from '../../hooks/notSameTenant';
import { invalidRanges, isBotJobType } from '../../bots/verify';
import { encrypt } from '../../invites/crypto';
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

const blank = (value: unknown): boolean => value == null || value === '';

// A job type, an api url and an api key make a row a provider; a row with none of
// them stays a plain bot key. Anything in between would be a provider that cannot
// be called, so it is refused. The key is write only: an empty one on a patch keeps
// what is stored, and clearing the url clears the whole provider part of the row.
export const validProvider = async (context: HookContext): Promise<HookContext> => {
	const data = context.data;

	if (!data) return context;

	const existing = context.method === 'patch' && context.id != null
		? await context.service.get(context.id, { provider: undefined, query: {} }) as Record<string, unknown>
		: {};

	const picked = (field: string) => (field in data ? data[field] : existing[field]);

	if ('apiUrl' in data && blank(data.apiUrl)) {
		data.apiUrl = null;
		data.jobType = null;
		data.apiSecret = null;

		return context;
	}

	const jobType = picked('jobType');
	const apiUrl = picked('apiUrl');
	// A patch without an api key keeps the stored one, so the row stays complete.
	const apiSecret = blank(data.apiSecret) ? existing.apiSecret : data.apiSecret;

	if (blank(jobType) && blank(apiUrl) && blank(apiSecret)) {
		if (context.method === 'create') {
			delete data.jobType;
			delete data.apiUrl;
			delete data.apiSecret;
		}

		return context;
	}

	if (blank(jobType) || blank(apiUrl) || blank(apiSecret))
		throw new BadRequest('A bot provider needs a job type, an API URL and an API key');

	if (!isBotJobType(jobType)) throw new BadRequest('Unknown bot job type');

	let parsed: URL;

	try {
		parsed = new URL(String(apiUrl));
	} catch {
		throw new BadRequest('The API URL is not a valid URL');
	}

	if (parsed.protocol !== 'https:') throw new BadRequest('The API URL must use https');

	// The room server appends its own paths to this address, and sends the key as a
	// header: a query, a fragment or a login in the address, or a key that is not
	// plain header text, would make calls that fail or go somewhere else.
	if (parsed.search || parsed.hash || parsed.username || parsed.password)
		throw new BadRequest('The API URL must not carry a query, a fragment or a login');

	if (!blank(data.apiSecret) && !/^[!-~]+$/.test(String(data.apiSecret)))
		throw new BadRequest('The API key may only contain printable characters without spaces');

	data.apiUrl = parsed.toString().replace(/\/$/, '');

	if (blank(data.apiSecret)) delete data.apiSecret;

	return context;
};

// The key is stored encrypted with the bots key, which is separate from the invites
// one so either can be rotated on its own.
export const encryptApiSecret = async (context: HookContext): Promise<HookContext> => {
	const secret = context.data?.apiSecret;

	if (blank(secret)) return context;

	const key = context.app.get('bots')?.encryptionKey;

	if (!key) throw new BadRequest('bots.encryptionKey is not configured on this server');

	context.data.apiSecret = encrypt(String(secret), key, 'bots.encryptionKey');

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
				validProvider,
				schemaHooks.resolveData(tenantBotCredentialDataResolver),
				serializeRanges,
				encryptApiSecret
			],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				iff(notSuperAdmin(), notInSameTenantByContextId),
				schemaHooks.validateData(tenantBotCredentialPatchValidator),
				validRanges,
				validProvider,
				schemaHooks.resolveData(tenantBotCredentialPatchResolver),
				serializeRanges,
				encryptApiSecret
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
