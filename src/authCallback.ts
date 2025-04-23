import Router from '@koa/router';
import DOMPurify from 'isomorphic-dompurify';

export const authCallback = () => new Router().get('/auth/callback', (ctx) => {
	// eslint-disable-next-line camelcase
	const { access_token, error } = ctx.request.query;

	// eslint-disable-next-line camelcase
	const clean = DOMPurify.sanitize(access_token as string);
	
	if (error) {
		const message = DOMPurify.sanitize(error as string);

		ctx.body =
		`<!DOCTYPE html>
		<html>
			<head>
				<meta charset='utf-8'>
				<title>edumeet</title>
			</head>
			<body>
				 ${message}!
			</body>
		</html>`;
	// eslint-disable-next-line camelcase
	} else if (!access_token) {
		ctx.status = 400;

		return;
	} else {
		ctx.body =
		`<!DOCTYPE html>
		<html>
			<head>
				<meta charset='utf-8'>
				<title>edumeet</title>
			</head>
			<body>
				<script type='text/javascript'>
					let data = ${JSON.stringify(clean)};
		
					window.opener.postMessage({
						type: 'edumeet-login',
						data
					}, '*');
		
					window.close();
				</script>
			</body>
		</html>`;
	}
	ctx.status = 200;
})
	.routes();
