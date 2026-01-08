import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';
import type { Application } from './declarations';

import type { TenantOAuth } from './services/tenantOAuths/tenantOAuths.schema';

type RedirectUriSource = Pick<TenantOAuth, 'redirect_uri' | 'end_session_endpoint' | 'key'>;

function getOriginFromRedirectUri(row: RedirectUriSource): string | undefined {
	if (!row) return undefined;

	if (typeof row.redirect_uri !== 'string' || !row.redirect_uri) {
		return undefined;
	}

	try {
		return new URL(row.redirect_uri).origin;
	} catch (_error) {
		return undefined;
	}
}

export const authLogout = () => {
	const router = new Router();

	router.get('/auth/logout', async (ctx) => {
		const tenantIdRaw = ctx.request.query.tenantId as string | undefined;
		const tenantId = Number(DOMPurify.sanitize(tenantIdRaw || ''));

		if (!tenantId) {
			ctx.throw(400, 'tenantId is required');
		}

		const app = ctx.app as unknown as Application;
		const tenantOAuthsService = app.service('tenantOAuths');

		type TenantOAuthFindResult = Awaited<ReturnType<typeof tenantOAuthsService.find>>;
		let res: TenantOAuthFindResult;

		try {
			res = await tenantOAuthsService.find({
				query: {
					tenantId,
					$limit: 1
				}
			});
		} catch (_error) {
			ctx.throw(500, 'Failed to load tenant OAuth config');

			return;
		}

		const row: RedirectUriSource | undefined = Array.isArray(res) ? res[0] : res?.data?.[0];
		const origin = getOriginFromRedirectUri(row);
		const closeUrl = origin ? `${origin}/auth/logout-close` : '/auth/logout-close';

		// Missing end_session_endpoint is NOT an error: just close the popup
		const endSessionEndpoint: unknown = row.end_session_endpoint;
		if (typeof endSessionEndpoint !== 'string' || !endSessionEndpoint) {
			ctx.redirect(closeUrl);

			return;
		}

		const url = new URL(endSessionEndpoint);
		url.searchParams.set('post_logout_redirect_uri', closeUrl);

		const clientIdValue: unknown = row.key;
		if (typeof clientIdValue === 'string' && clientIdValue) {
			url.searchParams.set('client_id', clientIdValue);
		}

		ctx.redirect(url.toString());
	});

	return router.routes();
};
