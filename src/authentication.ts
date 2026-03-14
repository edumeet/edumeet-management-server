// For more information about this file see https://dove.feathersjs.com/guides/cli/authentication.html
import { AuthenticationService, JWTStrategy, authenticate } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import { oauth } from '@feathersjs/authentication-oauth';
import type { Params } from '@feathersjs/feathers';

import type { Application } from './declarations';
import OAuthTenantStrategy from './auth/strategies/OAuthTenantStrategy';
import { OAuthService } from '@feathersjs/authentication-oauth/lib/service';
import { dynamicOAuth } from './hooks/dynamicOAuth';

declare module './declarations' {
	interface ServiceTypes {
		authentication: AuthenticationService;
		'oauth/:provider': OAuthService;
		'token-refresh': { create(data: unknown, params?: Params): Promise<{ accessToken: string }> };
	}
}

export const authentication = (app: Application) => {
	const authenticationService = new AuthenticationService(app, 'authentication');

	authenticationService.register('jwt', new JWTStrategy());
	authenticationService.register('local', new LocalStrategy());
	authenticationService.register('tenant', new OAuthTenantStrategy());

	app.use('authentication', authenticationService);
	// reconfigure / configure oauth this hardcodes the settings, so after change we have to unuse it and re apply
	app.configure(oauth());

	app.service('oauth/:provider').hooks(
		{
			before: { find: [ dynamicOAuth ] },
		});

	// Issues a fresh JWT for an already-authenticated user.
	// The caller must present a valid (non-expired) JWT; the response contains a new token
	// with a reset expiry window, keeping active users logged in indefinitely.
	app.use('token-refresh', {
		async create(_data: unknown, _params?: Params): Promise<{ accessToken: string }> {
			const accessToken = await authenticationService.createAccessToken(
				{ sub: String(_params?.user?.id) },
				app.get('authentication').jwtOptions
			);

			return { accessToken };
		}
	}, { methods: [ 'create' ], events: [] });

	app.service('token-refresh').hooks({
		around: {
			create: [ authenticate('jwt') ]
		}
	});
};
