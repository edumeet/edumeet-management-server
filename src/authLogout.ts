/* eslint-disable camelcase */
import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';

export const authLogout = () =>
	new Router().get('/auth/logout', async (ctx) => {
		const tenantIdRaw = ctx.request.query.tenantId as string | undefined;
		const tenantId = Number(DOMPurify.sanitize(tenantIdRaw || ''));

		if (!tenantId)
			ctx.throw(400, 'tenantId is required');

		const app = (ctx.app.context as any).app;

		if (!app?.service)
			ctx.throw(500, 'Feathers app is not available on Koa context');

		const tenantOAuthsService = app.service('tenantOAuths');

		const res = await tenantOAuthsService.find({
			query:
			{
				tenantId,
				$limit: 1
			}
		});

		const row = Array.isArray(res) ? res[0] : res?.data?.[0];

		if (!row)
			ctx.throw(404, `No tenantOAuth config found for tenantId=${tenantId}`);

		const endSession = row.end_session_endpoint as unknown;

		if (typeof endSession !== 'string' || !endSession)
			ctx.throw(400, `Missing end_session_endpoint for tenantId=${tenantId}`);

		const clientId = row.key as unknown;

		const closeUrl = `${ctx.origin}/auth/logout-close`;

		const url = new URL(endSession);
		url.searchParams.set('post_logout_redirect_uri', closeUrl);

		if (typeof clientId === 'string' && clientId)
			url.searchParams.set('client_id', clientId);

		ctx.redirect(url.toString());
	}).routes();
