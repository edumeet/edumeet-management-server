import Router from '@koa/router';
import { consumeCallbackCode } from './auth/callbackCodes';

export interface AuthCallbackContext {
	request: { query: Record<string, unknown> };
	status: number;
	body: unknown;
	// eslint-disable-next-line no-unused-vars
	set(field: string, value: string): void;
}

const page = (content: string) =>
	`<!DOCTYPE html>
	<html>
		<head>
			<meta charset='utf-8'>
			<title>edumeet</title>
		</head>
		<body>
			${content}
		</body>
	</html>`;

const scriptString = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

// The error text comes from the URL, so anyone can make this page show what they want under
// this server's address. Shown as text only, it cannot add a form or a link.
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const NO_ACTIVE_CONTENT = 'default-src \'none\'; form-action \'none\'; base-uri \'none\'';

export const handleAuthCallback = (ctx: AuthCallbackContext): void => {
	const { code, error } = ctx.request.query;

	ctx.set('Cache-Control', 'no-store');

	if (error) {
		ctx.status = 200;
		ctx.set('Content-Security-Policy', NO_ACTIVE_CONTENT);
		ctx.body = page(`${escapeHtml(String(error))}!`);

		return;
	}

	const entry = consumeCallbackCode(code);

	if (!entry) {
		ctx.status = 400;
		ctx.set('Content-Security-Policy', NO_ACTIVE_CONTENT);
		ctx.body = page('This sign in link has expired. Close this tab and sign in again.');

		return;
	}

	ctx.status = 200;
	ctx.body = page(
		`<script type='text/javascript'>
			if (window.opener) {
				window.opener.postMessage({
					type: 'edumeet-login',
					data: ${scriptString(entry.accessToken)},
					idToken: ${scriptString(entry.idToken ?? '')}
				}, ${scriptString(entry.origin)});
			}

			window.close();
		</script>`
	);
};

export const authCallback = () => new Router().get('/auth/callback', (ctx) => handleAuthCallback(ctx))
	.routes();
