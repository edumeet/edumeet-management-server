import dns from 'dns';
import { BlockList, isIP } from 'net';
import { BadRequest } from '@feathersjs/errors';
import { getGrantConfig } from '@feathersjs/authentication-oauth/lib/utils';
import type { Application, HookContext } from '../declarations';

// A tenant admin sets the URLs the management server fetches at sign in (the identity
// provider's token and profile endpoints). Without limits they could make it call its own
// host and networks: databases, cloud metadata, other containers.

// Two lists: a BlockList also checks an IPv4 address against its IPv6 rules, as ::ffff:a.b.c.d,
// so the IPv4-mapped rule below would match every IPv4 address.
const ownIpv4 = new BlockList();
const ownIpv6 = new BlockList();

for (const [ network, prefix ] of [
	[ '0.0.0.0', 8 ], [ '10.0.0.0', 8 ], [ '100.64.0.0', 10 ], [ '127.0.0.0', 8 ], [ '169.254.0.0', 16 ],
	[ '172.16.0.0', 12 ], [ '192.0.0.0', 24 ], [ '192.168.0.0', 16 ], [ '198.18.0.0', 15 ], [ '224.0.0.0', 3 ]
] as const) ownIpv4.addSubnet(network, prefix, 'ipv4');

// IPv4-mapped, NAT64 and 6to4 addresses can carry any IPv4 address, so they are refused too.
for (const [ network, prefix ] of [
	[ '::', 96 ], [ '::ffff:0:0', 96 ], [ '64:ff9b::', 96 ], [ '100::', 64 ], [ '2002::', 16 ],
	[ 'fc00::', 7 ], [ 'fe80::', 10 ], [ 'ff00::', 8 ]
] as const) ownIpv6.addSubnet(network, prefix, 'ipv6');

export const isOwnNetworkAddress = (address: string): boolean => {
	const family = isIP(address);

	if (family === 4) return ownIpv4.check(address, 'ipv4');
	if (family === 6) return ownIpv6.check(address, 'ipv6');

	return true;
};

// Hosts the operator allows on a private network, for example an internal Keycloak.
const privateHosts = (app: Application): Set<string> =>
	new Set(((app.get('oauthPrivateHosts') as string[] | undefined) ?? []).map((host) => String(host).toLowerCase()));

const hostOf = (url: URL): string => url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

export const OAUTH_URL_KEYS = [ 'authorize_url', 'access_url', 'profile_url' ] as const;

/**
 * What is wrong with a tenant's identity provider URL, or undefined. Names are resolved now
 * as well; the connection itself is checked again when it is made (oauthLookup).
 */
export const oauthUrlProblem = async (app: Application, value: unknown): Promise<string | undefined> => {
	let url: URL;

	try {
		url = new URL(String(value));
	} catch {
		return 'must be an absolute URL';
	}

	const host = hostOf(url);
	const allowed = privateHosts(app).has(host);

	if (url.username || url.password) return 'must not contain a user name or password';
	if (url.protocol !== 'https:' && !(allowed && url.protocol === 'http:')) return 'must start with https://';
	if (allowed) return undefined;
	if (isIP(host)) return isOwnNetworkAddress(host) ? 'must not point to a private or local address' : undefined;

	const addresses = await dns.promises.lookup(host, { all: true }).catch(() => []);

	return addresses.some((a) => isOwnNetworkAddress(a.address)) ? 'must not point to a private or local address' : undefined;
};

/** A stored URL whose host is a private or local IP address the operator did not allow. */
export const hasOwnNetworkIp = (app: Application, value: unknown): boolean => {
	try {
		const host = hostOf(new URL(String(value)));

		return isIP(host) !== 0 && isOwnNetworkAddress(host) && !privateHosts(app).has(host);
	} catch {
		return true;
	}
};

// tenantOAuths before hook for create and patch, after validateData.
export const checkOAuthUrls = async (context: HookContext): Promise<HookContext> => {
	const data = (context.data ?? {}) as Record<string, unknown>;

	for (const key of OAUTH_URL_KEYS) {
		if (data[key] === undefined) continue;

		const problem = await oauthUrlProblem(context.app, data[key]);

		if (problem) throw new BadRequest(`${key} ${problem}`);
	}

	return context;
};

// eslint-disable-next-line no-unused-vars
type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

/**
 * dns.lookup for the requests to the identity providers: an address of the server's own
 * networks is never returned, unless the operator allows the host. Node does not call it for
 * an IP address in the URL; those are refused when stored and when loaded.
 */
export const oauthLookup = (app: Application) =>
	(hostname: string, options: dns.LookupOptions | number, callback: LookupCallback): void => {
		const opts: dns.LookupOptions = typeof options === 'number' ? { family: options } : (options ?? {});

		dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
			if (err) return callback(err);

			const usable = privateHosts(app).has(hostname.toLowerCase())
				? addresses
				: addresses.filter((a) => !isOwnNetworkAddress(a.address));

			if (usable.length === 0) {
				const refused: NodeJS.ErrnoException = new Error(`${hostname} resolves only to private or local addresses`);

				refused.code = 'ENOTFOUND';

				return callback(refused);
			}

			if (opts.all) return callback(null, usable);

			callback(null, usable[0].address, usable[0].family);
		});
	};

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-require-imports
const grant = require('grant/lib/grant') as (options: { config: unknown, request: Record<string, unknown> }) => unknown;

/**
 * Rebuild the grant instance of the oauth service so its token and profile requests use
 * oauthLookup and follow no redirects: a redirect to an IP address would skip the lookup.
 * Call after every app.configure(oauth()).
 */
export const restrictOAuthRequests = (app: Application): void => {
	const authService = app.service('authentication');

	if (!authService?.configuration?.oauth) return;

	// The callback service makes those requests, and it calls the OAuthService object it was
	// built with. app.service('oauth/:provider') is not that object but one Feathers derives
	// from it: a grant set there is only used for the redirect to the provider.
	const { service } = app.service('oauth/:provider/callback');

	if (typeof service?.handler !== 'function') throw new Error('oauth service not found, its requests cannot be restricted');

	service.grant = grant({
		config: getGrantConfig(authService),
		request: { lookup: oauthLookup(app), redirect: { max: 0 } }
	});
};
