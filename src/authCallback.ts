import Router from '@koa/router';
import DOMPurify from 'dompurify';

export const authCallback = () => new Router().get('/auth/callback', (ctx) => {
	// eslint-disable-next-line camelcase
	const { access_token } = ctx.request.query;

	const clean:string = DOMPurify.sanitize(access_token);
	
	// eslint-disable-next-line camelcase
	if (!access_token) {
		ctx.status = 400;

		return;
	}

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

	ctx.status = 200;
})
	.routes();
