import Router from '@koa/router';

export const authLogoutClose = () =>
	new Router().get('/auth/logout-close', (ctx) => {
		ctx.type = 'html';
		ctx.body = `<!doctype html>
<html>
	<head><meta charset="utf-8"><title>Logged out</title></head>
	<body>
		<script>
			window.close();

			setTimeout(() => {
				document.body.innerText = 'You are logged out. You can close this tab.';
			}, 2000);
		</script>
	</body>
</html>`;
	})
	.routes();