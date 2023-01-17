// For more information about this file see https://dove.feathersjs.com/guides/cli/authentication.html
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import { oauth, OAuthStrategy } from '@feathersjs/authentication-oauth';

import type { Application } from './declarations';

declare module './declarations' {
	interface ServiceTypes {
		authentication: AuthenticationService
	}
}

export const authentication = (app: Application) => {
	const authenticationService = new AuthenticationService(app);

	authenticationService.register('jwt', new JWTStrategy());
	authenticationService.register('local', new LocalStrategy());
	authenticationService.register('auth0', new OAuthStrategy());

	app.use('authentication', authenticationService);
	app.configure(oauth());
};
