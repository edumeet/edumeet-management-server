/* eslint-disable camelcase */
import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';

function assertNonEmptyString(value: unknown, message: string): asserts value is string
{
	if (typeof value !== 'string' || !value)
		throw new Error(message);
}

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

		const endSessionEndpoint: unknown = row.end_session_endpoint;
		assertNonEmptyString(endSessionEndpoint, `Missing end_session_endpoint for tenantId=${tenantId}`);

		const closeUrl = `${ctx.origin}/auth/logout-close`;

		const url = new URL(endSessionEndpoint);
		url.searchParams.set('post_logout_redirect_uri', closeUrl);

		const clientIdValue: unknown = row.key;

		if (typeof clientIdValue === 'string' && clientIdValue)
			url.searchParams.set('client_id', clientIdValue);

		ctx.redirect(url.toString());
	}).routes();
