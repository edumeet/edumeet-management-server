/* eslint-disable camelcase */
import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';

export const authLogout = () =>
	new Router().get('/auth/logout', async (ctx) => {
		const tenantIdRaw = ctx.request.query.tenantId as string | undefined;
		const tenantId = Number(DOMPurify.sanitize(tenantIdRaw || ''));

		if (!tenantId)
			ctx.throw(400, 'tenantId is required');

		// Feathers app is attached to Koa's context in this project
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

		const endSession = row.end_session_endpoint as string | null | undefined;
		const clientId = row.key as string | null | undefined;

		if (!endSession || typeof endSession !== 'string')
			ctx.throw(400, `Missing end_session_endpoint for tenantId=${tenantId}`);

		const endSessionEndpoint: string = endSession;

		const closeUrl = `${ctx.origin}/auth/logout-close`;

		const url = new URL(endSessionEndpoint);
		url.searchParams.set('post_logout_redirect_uri', closeUrl);

		if (clientId && typeof clientId === 'string')
			url.searchParams.set('client_id', clientId);

		ctx.redirect(url.toString());
	}).routes();