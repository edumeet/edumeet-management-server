// For more information about this file see https://dove.feathersjs.com/guides/cli/authentication.html
import { AuthenticationService, JWTStrategy, authenticate } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import { oauth } from '@feathersjs/authentication-oauth';
import type { Params } from '@feathersjs/feathers';

import type { Application } from './declarations';
import OAuthTenantStrategy from './auth/strategies/OAuthTenantStrategy';
import { OAuthService } from '@feathersjs/authentication-oauth/lib/service';
import { dynamicOAuth } from './hooks/dynamicOAuth';
import { loginThrottleBefore, loginThrottleError } from './hooks/loginThrottle';
import { refreshAccessCheck } from './hooks/refreshAccessCheck';
import { EdumeetAuthenticationService } from './auth/EdumeetAuthenticationService';

declare module './declarations' {
	interface ServiceTypes {
		authentication: AuthenticationService;
		'oauth/:provider': OAuthService;
		// eslint-disable-next-line no-unused-vars
		'token-refresh': { create(data: unknown, params?: Params): Promise<{ accessToken: string }> };
	}
}

export const authentication = (app: Application) => {
	const authenticationService = new EdumeetAuthenticationService(app, 'authentication');

	authenticationService.register('jwt', new JWTStrategy());
	authenticationService.register('local', new LocalStrategy());
	authenticationService.register('tenant', new OAuthTenantStrategy());

	app.use('authentication', authenticationService);

	// Per-IP brute-force throttle + timing pad for the local strategy.
	app.service('authentication').hooks({
		before: { create: [ loginThrottleBefore ] },
		error: { create: [ loginThrottleError ] }
	});

	// reconfigure / configure oauth this hardcodes the settings, so after change we have to unuse it and re apply
	app.configure(oauth());

	app.service('oauth/:provider').hooks(
		{
			before: { find: [ dynamicOAuth ] },
		});

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
