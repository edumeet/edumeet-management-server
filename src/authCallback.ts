import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';
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

export const handleAuthCallback = (ctx: AuthCallbackContext): void => {
	const { code, error } = ctx.request.query;

	ctx.set('Cache-Control', 'no-store');

	if (error) {
		ctx.status = 200;
		ctx.body = page(`${DOMPurify.sanitize(String(error))}!`);

		return;
	}

	const entry = consumeCallbackCode(code);

	if (!entry) {
		ctx.status = 400;
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
