/* eslint-disable camelcase */
import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';

export const authLogout = () =>
	new Router().get('/auth/logout', async (ctx) => {
		const tenantIdRaw = ctx.request.query.tenantId as string | undefined;
		const tenantId = Number(DOMPurify.sanitize(tenantIdRaw || ''));

		const closeUrl = `${ctx.origin}/auth/logout-close`;

		// If tenantId is missing/invalid, just close the popup
		if (!tenantId)
		{
			ctx.redirect(closeUrl);
			return;
		}

		const tenantOAuthsService = (ctx.app as any).service('tenantOAuths');

		let row: any;

		try
		{
			const res = await tenantOAuthsService.find({
				query:
				{
					tenantId,
					$limit: 1
				}
			});

			row = Array.isArray(res) ? res[0] : res?.data?.[0];
		}
		catch (error)
		{
			// If we can't fetch tenant OAuth config, just close the popup
			ctx.redirect(closeUrl);
			return;
		}

		const endSessionEndpoint = row?.end_session_endpoint as unknown;

		// If not configured, just close the popup
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
