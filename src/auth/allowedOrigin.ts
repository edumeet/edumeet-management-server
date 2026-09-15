import { NotAuthenticated } from '@feathersjs/errors';
import type { Application } from '../declarations';
import type { TenantFqdn } from '../services/tenantFQDNs/tenantFQDNs.schema';

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

	if (!Number.isInteger(tenantId)) {
		throw new NotAuthenticated('Sign in was started without a valid tenant');
	}

	const result = await app.service('tenantFQDNs').find({ paginate: false, query: { tenantId } });
	const rows = (Array.isArray(result) ? result : (result as { data: TenantFqdn[] }).data) as TenantFqdn[];

	const registered = rows.some(({ fqdn }) => {
		const name = String(fqdn).toLowerCase();

		return name === url.hostname || name === url.host;
	});

	if (!registered) {
		throw new NotAuthenticated('Sign in was started from a site that does not belong to this tenant');
	}

	return url.origin;
};
