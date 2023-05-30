// For more information about this file see https://dove.feathersjs.com/guides/cli/authentication.html
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import { oauth } from '@feathersjs/authentication-oauth';

import type { Application } from './declarations';
import OAuthTenantStrategy from './auth/strategies/OAuthTenantStrategy';
import { OAuthService } from '@feathersjs/authentication-oauth/lib/service';
import { dynamicOAuth } from './hooks/dynamicOAuth';

declare module './declarations' {
	interface ServiceTypes {
		authentication: AuthenticationService;
		'oauth/:provider': OAuthService;
	}
}

export const authentication = (app: Application) => {
	const authenticationService = new AuthenticationService(app);

	authenticationService.register('jwt', new JWTStrategy());
	authenticationService.register('local', new LocalStrategy());
	authenticationService.register('tenant', new OAuthTenantStrategy());

	app.use('authentication', authenticationService);
	app.configure(oauth());

	app.service('oauth/:provider').hooks({ before: { find: [ dynamicOAuth ] } });
};
