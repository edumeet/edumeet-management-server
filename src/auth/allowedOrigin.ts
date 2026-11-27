import { NotAuthenticated } from '@feathersjs/errors';
import type { Application } from '../declarations';
import type { TenantFqdn } from '../services/tenantFQDNs/tenantFQDNs.schema';

// This computer itself, where a development client runs over http and on a port of its own.
const isLoopback = (hostname: string): boolean =>
	hostname === 'localhost' || hostname === '[::1]' || /^127(\.[0-9]{1,3}){3}$/.test(hostname);

/**
 * The origin a sign-in was started from, if it is a site of the tenant. The token is handed
 * to a page of exactly this origin, so scheme and port count as much as the host name:
 *
 * - https only. A page loaded over http can be replaced by anyone between the browser and the
 *   server.
 * - A registered name without a port stands for the default https port. Another port of the
 *   same host is another service and has to be registered as `name:port`.
 * - On this computer (localhost, 127.x.x.x, [::1]) http and any port are fine, for development.
 *   The name still has to be registered for the tenant.
 */
export const resolveAllowedOrigin = async (
	app: Application,
	tenantId: number,
	origin: unknown
): Promise<string> => {
	if (typeof origin !== 'string' || origin.length === 0) {
		throw new NotAuthenticated('Sign in was started without an origin, reload the page and try again');
	}

	let url: URL;

	try {
		url = new URL(origin);
	} catch {
		throw new NotAuthenticated('Sign in was started from an invalid origin');
	}

	if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin !== origin) {
		throw new NotAuthenticated('Sign in was started from an invalid origin');
	}

	const loopback = isLoopback(url.hostname);

	if (url.protocol !== 'https:' && !loopback) {
		throw new NotAuthenticated('Sign in was started from a page without https');
	}

	if (!Number.isInteger(tenantId)) {
		throw new NotAuthenticated('Sign in was started without a valid tenant');
	}

	const result = await app.service('tenantFQDNs').find({ paginate: false, query: { tenantId } });
	const rows = (Array.isArray(result) ? result : (result as { data: TenantFqdn[] }).data) as TenantFqdn[];

	const registered = rows.some(({ fqdn }) => {
		const name = String(fqdn).toLowerCase();

		// url.port is empty on the scheme's default port
		return name === url.host || (name === url.hostname && (url.port === '' || loopback));
	});

	if (!registered) {
		throw new NotAuthenticated('Sign in was started from a site that does not belong to this tenant');
	}

	return url.origin;
};
