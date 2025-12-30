/* eslint-disable camelcase */
import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';

function getOriginFromRedirectUri(row: any): string | undefined
{
	const value: unknown = row?.redirect_uri ?? row?.redirectUri ?? row?.redirectURL ?? row?.redirectUrl;

	if (typeof value !== 'string' || !value)
		return undefined;

	try
	{
		return new URL(value).origin;
	}
	catch (error)
	{
		return undefined;
	}
}

export const authLogout = () =>
	new Router().get('/auth/logout', async (ctx) => {
		const tenantIdRaw = ctx.request.query.tenantId as string | undefined;
		const tenantId = Number(DOMPurify.sanitize(tenantIdRaw || ''));

		if (!tenantId)
			ctx.throw(400, 'tenantId is required');

		const tenantOAuthsService = (ctx.app as any).service('tenantOAuths');

		let res: any;

		try
		{
			res = await tenantOAuthsService.find({
				query:
				{
					tenantId,
					$limit: 1
				}
			});
		}
		catch (error)
		{
			ctx.throw(500, 'Failed to load tenant OAuth config');
			return;
		}

		const row = Array.isArray(res) ? res[0] : res?.data?.[0];

		if (!row)
			ctx.throw(404, `No tenantOAuth config found for tenantId=${tenantId}`);

		const origin = getOriginFromRedirectUri(row);
		const closeUrl = origin ? `${origin}/auth/logout-close` : '/auth/logout-close';

		const endSessionEndpoint = row?.end_session_endpoint as unknown;

		// Missing end_session_endpoint is NOT an error: just close the popup
		if (typeof endSessionEndpoint !== 'string' || !endSessionEndpoint)
		{
			ctx.redirect(closeUrl);
			return;
		}

		const url = new URL(endSessionEndpoint);
		url.searchParams.set('post_logout_redirect_uri', closeUrl);

		const clientIdValue = row?.key as unknown;

		if (typeof clientIdValue === 'string' && clientIdValue)
			url.searchParams.set('client_id', clientIdValue);

		ctx.redirect(url.toString());
	}).routes();
