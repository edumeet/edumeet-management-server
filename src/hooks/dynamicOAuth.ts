/* eslint-disable camelcase */
import { oauth } from '@feathersjs/authentication-oauth';
import { OAuthError } from '@feathersjs/authentication-oauth/lib/service';
import qs from 'qs';
import { Application, HookContext, NextFunction } from '../declarations';
import { resolveAllowedOrigin } from '../auth/allowedOrigin';

// The OAuth providers of the tenants live in app.get('authentication').oauth[tenantId].
// @feathersjs/authentication-oauth reads that configuration only when the oauth service is
// configured, so after a change the service has to be registered again.

// Query parameter that marks the request we redirect to after loading a tenant's
// configuration; prevents a redirect loop if the configuration is still missing then.
const RELOAD_PARAM = 'oauthReload';

const errorPage = (message: string) =>
	new OAuthError(message, undefined, `/auth/callback?${qs.stringify({ error: message })}`);

/**
 * Default callback URL for tenant providers: <origin><prefix>/tenant/callback.
 * The callback must use the provider name "tenant", because @feathersjs/authentication-oauth
 * looks up the authentication strategy by that name (OAuthTenantStrategy is registered as
 * "tenant"); the tenant itself is known from the session. The origin is
 * authentication.oauth.defaults.origin (set from MGMT_URL behind a reverse proxy), otherwise
 * the same default @feathersjs/authentication-oauth uses.
 */
export const tenantCallbackUrl = (app: Application): string => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const defaults: Record<string, any> = app.get('authentication')?.oauth?.defaults ?? {};
	let origin: string | undefined = defaults.origin;

	if (!origin) {
		const port = app.get('port');
		const host = app.get('host');

		origin = process.env.NODE_ENV === 'production' || String(port) === '80'
			? `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${host}`
			: `http://${host}:${port}`;
	}

	return `${origin.replace(/\/+$/, '')}${defaults.prefix ?? '/oauth'}/tenant/callback`;
};

const reconfigureOAuth = (app: Application) => {
	app.unuse('oauth/:provider');
	app.configure(oauth());
	app.service('oauth/:provider').hooks({
		before: { find: [ dynamicOAuth ] },
	});
};

// Pending refresh per app and tenant. Refreshes of the same tenant run one after another,
// each reading the database itself, so a slow earlier read can't overwrite a newer one.
const pendingRefreshes = new WeakMap<Application, Map<string, Promise<boolean>>>();

/**
 * Copy a tenant's OAuth settings from the database into the live configuration, or remove
 * them there when the tenant has no complete OAuth configuration (anymore).
 *
 * Re-registers the oauth service unless `reconfigure` is false (when loading many tenants at once).
 * Returns true when the tenant has a usable configuration afterwards.
 */
export const loadTenantOAuth = (
	app: Application,
	tenantId: number | string,
	reconfigure = true
): Promise<boolean> => {
	let perApp = pendingRefreshes.get(app);

	if (!perApp) {
		perApp = new Map();
		pendingRefreshes.set(app, perApp);
	}

	const key = String(tenantId);
	const previous = perApp.get(key) ?? Promise.resolve(false);
	const refresh = previous.catch(() => false).then(() => refreshTenantOAuth(app, tenantId, reconfigure));

	perApp.set(key, refresh);
	refresh.catch(() => false).finally(() => {
		if (perApp?.get(key) === refresh) perApp.delete(key);
	});

	return refresh;
};

const refreshTenantOAuth = async (
	app: Application,
	tenantId: number | string,
	reconfigure: boolean
): Promise<boolean> => {
	const config = app.get('authentication');

	if (!config?.oauth) return false;

	const { data } = await app.service('tenantOAuths').find({ query: { tenantId: Number(tenantId), $limit: 1 } });
	const row = data[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const providers: Record<string, any> = config.oauth;
	const usable = Boolean(row?.key && row.secret && row.authorize_url && row.access_url && row.profile_url);

	if (usable) {
		providers[tenantId] = {
			oauth: 2,
			key: row.key,
			client_id: row.key,
			secret: row.secret,
			scope: row.scope === undefined ? 'openid profile email' : row.scope,
			authorize_url: row.authorize_url,
			access_url: row.access_url,
			profile_url: row.profile_url,
			// An absolute URL is required (the identity provider redirects the browser there).
			redirect_uri: row.redirect_uri || tenantCallbackUrl(app),
			scope_delimiter: row.scope_delimiter === undefined ? ' ' : row.scope_delimiter,
			name_parameter: row.name_parameter,
			token_endpoint_auth_method: 'client_secret_basic'
		};
	} else if (tenantId in providers) {
		delete providers[tenantId];
	} else {
		return false;
	}

	app.set('authentication', config);

	if (reconfigure) reconfigureOAuth(app);

	return usable;
};

export const dynamicOAuth = async (context: HookContext) => {
	if (context.params.headers['user-agent']) {
		delete context.params.headers['user-agent'];
	}

	const query = context.params.query ?? {};
	const { tenantId } = query;

	if (!tenantId) throw new Error('Missing tenantId');

	const authService = context.app.service('authentication');

	if (!authService.configuration.oauth?.[tenantId]) {
		// Tenant not loaded yet (e.g. OAuth configured after startup).
		if (query[RELOAD_PARAM] || !await loadTenantOAuth(context.app, tenantId)) {
			throw errorPage('Missing OAuth configuration');
		}

		// This request is still handled by the previous oauth service, which doesn't know the
		// tenant. Send the browser to the same URL again (relative, so it works behind a proxy
		// prefix like /mgmt/); the new service handles it.
		throw new OAuthError('OAuth configuration loaded', undefined, `?${qs.stringify({ ...query, [RELOAD_PARAM]: 1 })}`);
	}

	delete query[RELOAD_PARAM];

	try {
		query.origin = await resolveAllowedOrigin(
			context.app,
			parseInt(tenantId),
			query.origin
		);
	} catch (error) {
		throw errorPage((error as Error).message);
	}

	context.params.route.provider = tenantId;
};

// Application setup hook: load the OAuth settings of all tenants once at startup.
export const dynamicOAuthSetup = async (context: HookContext, next: NextFunction) => {
	const rows = await context.app.service('tenantOAuths').find({
		query: { $select: [ 'tenantId' ] },
		paginate: false
	});

	for (const { tenantId } of rows) {
		await loadTenantOAuth(context.app, tenantId, false);
	}

	if (rows.length) reconfigureOAuth(context.app);

	await next();
};

type TenantId = number | string;
type TenantRef = { tenantId?: TenantId } | null | undefined;

const tenantIdsOf = (value: unknown): TenantId[] =>
	(Array.isArray(value) ? value : [ value ])
		.map((r: TenantRef) => r?.tenantId)
		.filter((t): t is TenantId => t !== undefined && t !== null);

// Tenants an operation touched, collected by rememberOAuthTenants (before) for reloadTenantOAuth (after).
const touchedTenants = new WeakMap<object, TenantId[]>();

/**
 * tenantOAuths before hook for patch and remove (register it after the permission checks):
 * remember which tenants the affected entries belong to now. The result alone isn't enough:
 * a `$select` without tenantId hides it, and a patch can move an entry to another tenant.
 */
export const rememberOAuthTenants = async (context: HookContext) => {
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	const { $select, ...query } = context.params.query ?? {};
	// adapter methods: read the rows as they are, without running the service hooks again
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const service = context.service as any;
	const rows = context.id !== undefined && context.id !== null
		? [ await service._get(context.id, { query }).catch(() => null) ]
		: await service._find({ query, paginate: false });

	touchedTenants.set(context, tenantIdsOf(rows));

	return context;
};

// tenantOAuths after hook: apply created, changed and removed configurations immediately.
export const reloadTenantOAuth = async (context: HookContext) => {
	const tenantIds = new Set<string>([
		...(touchedTenants.get(context) ?? []),
		...tenantIdsOf(context.data),
		...tenantIdsOf(context.result)
	].map(String));

	for (const tenantId of tenantIds) {
		await loadTenantOAuth(context.app, tenantId);
	}

	return context;
};
