import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';
import type { Application } from './declarations';

import type { TenantOAuth } from './services/tenantOAuths/tenantOAuths.schema';

type RedirectUriSource = Pick<TenantOAuth, 'redirect_uri' | 'end_session_endpoint' | 'key'>;

function getOriginFromRedirectUri(row: RedirectUriSource | undefined): string | undefined {
	if (!row) {
		return undefined;
	}

	if (!row.redirect_uri) {
		return undefined;
	}

	try {
		return new URL(row.redirect_uri).origin;
	} catch {
		return undefined;
	}
}

export const authLogout = () => {
	const router = new Router();

	router.get('/auth/logout', async (ctx) => {
		const tenantIdRaw = ctx.request.query.tenantId as string | undefined;
		const tenantId = Number(DOMPurify.sanitize(tenantIdRaw ?? ''));

		if (!tenantId) {
			ctx.throw(400, 'tenantId is required');

			return;
		}

		const app = ctx.app as unknown as Application;
		const tenantOAuthsService = app.service('tenantOAuths');

		const res = await tenantOAuthsService.find({
			query: {
				tenantId,
				$limit: 1
			}
		});

		const row: RedirectUriSource | undefined = Array.isArray(res)
			? res[0]
			: res.data?.[0];

		const origin = getOriginFromRedirectUri(row);
		const closeUrl = origin
			? `${origin}/auth/logout-close`
			: '/auth/logout-close';

		const endSessionEndpoint = row?.end_session_endpoint;

		if (!endSessionEndpoint) {
			ctx.redirect(closeUrl);

			return;
		}

		const url = new URL(endSessionEndpoint);

		url.searchParams.set('post_logout_redirect_uri', closeUrl);

		if (row?.key) {
			url.searchParams.set('client_id', row.key);
		}

		ctx.redirect(url.toString());
	});

	return router.routes();
};
