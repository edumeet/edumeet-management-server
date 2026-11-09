// For more information about this file see https://dove.feathersjs.com/guides/cli/authentication.html
import { AuthenticationService, JWTStrategy, authenticate } from '@feathersjs/authentication';
import { oauth } from '@feathersjs/authentication-oauth';
import type { Params } from '@feathersjs/feathers';

import type { Application } from './declarations';
import OAuthTenantStrategy from './auth/strategies/OAuthTenantStrategy';
import { OAuthCallbackService, OAuthService } from '@feathersjs/authentication-oauth/lib/service';
import { oauthCallbackHooks, oauthServiceHooks } from './hooks/dynamicOAuth';
import { loginThrottleBefore, loginThrottleError } from './hooks/loginThrottle';
import { refreshAccessCheck } from './hooks/refreshAccessCheck';
import { EdumeetAuthenticationService } from './auth/EdumeetAuthenticationService';
import { EdumeetLocalStrategy } from './auth/EdumeetLocalStrategy';

declare module './declarations' {
	interface ServiceTypes {
		authentication: AuthenticationService;
		'oauth/:provider': OAuthService;
		'oauth/:provider/callback': OAuthCallbackService;
		// eslint-disable-next-line no-unused-vars
		'token-refresh': { create(data: unknown, params?: Params): Promise<{ accessToken: string }> };
	}
}

export const authentication = (app: Application) => {
	const authenticationService = new EdumeetAuthenticationService(app, 'authentication');

	authenticationService.register('jwt', new JWTStrategy());
	authenticationService.register('local', new EdumeetLocalStrategy());
	authenticationService.register('tenant', new OAuthTenantStrategy());

	app.use('authentication', authenticationService);

	// Per-IP brute-force throttle + timing pad for the local strategy.
	app.service('authentication').hooks({
		before: { create: [ loginThrottleBefore ] },
		error: { create: [ loginThrottleError ] }
	});

	// Public URL of this server, e.g. https://example.com/mgmt behind a reverse proxy. Tenant OAuth
	// providers without an explicit redirect_uri get <MGMT_URL>/oauth/tenant/callback;
	// otherwise the callback would be built from host/port (http://0.0.0.0:3030/...).
	// authentication.oauth.defaults.origin in the config takes precedence.
	const oauthConfig = app.get('authentication')?.oauth as { defaults?: Record<string, unknown> } | undefined;

	if (oauthConfig && process.env.MGMT_URL && !oauthConfig.defaults?.origin) {
		oauthConfig.defaults = { ...oauthConfig.defaults, origin: process.env.MGMT_URL.replace(/\/+$/, '') };
	}

	// reconfigure / configure oauth this hardcodes the settings, so after change we have to unuse it and re apply
	app.configure(oauth());

	app.service('oauth/:provider').hooks(oauthServiceHooks());
	app.service('oauth/:provider/callback').hooks(oauthCallbackHooks());

	// Issues a fresh JWT for an already-authenticated user. refreshAccessCheck runs first,
	// so the new token keeps the original auth_time and the session ends at its maximum age.
	app.use('token-refresh', {
		async create(_data: unknown, _params?: Params): Promise<{ accessToken: string }> {
			const jwtOptions = app.get('authentication')?.jwtOptions ?? {};
			const accessToken = await authenticationService.createAccessToken(
				// eslint-disable-next-line camelcase
				{ sub: String(_params?.user?.id), auth_time: _params?.authentication?.payload?.auth_time },
				jwtOptions
			);

			return { accessToken };
		}
	}, { methods: [ 'create' ], events: [] });

	app.service('token-refresh').hooks({
		around: {
			create: [ authenticate('jwt') ]
		},
		before: {
			create: [ refreshAccessCheck ]
		}
	});
};
