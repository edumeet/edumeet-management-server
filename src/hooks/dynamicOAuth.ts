/* eslint-disable camelcase */
import { oauth } from '@feathersjs/authentication-oauth';
import { HookContext } from '../declarations';

export const dynamicOAuth = async (context: HookContext) => {
	if (context.params.headers['user-agent']) {
		delete context.params.headers['user-agent'];
	}

	const { tenantId } = context.params.query;
	
	if (!tenantId) throw new Error('Missing tenantId');

	// if tenantid is valid and unknown in the oauth config 
	// we have to configure and restart oauth settings
	const authService = context.app.service('authentication');

	// no tenant found 
	if (!authService.configuration.oauth?.[tenantId]) {
		// get tenant data
		const { total, data } = await context.app.service('tenantOAuths').find({ query: { tenantId } });

		if (total === 0) throw new Error('Missing OAuth configuration');

		const {
			key,
			secret,
			authorize_url,
			access_url,
			profile_url,
			redirect_uri = '/oauth/tenant/callback',
			scope = 'openid profile email',
			scope_delimiter = ' ',
			name_parameter
		} = data[0];

		if (!key) throw new Error('Missing OAuth key');
		if (!secret) throw new Error('Missing OAuth secret');
		if (!authorize_url) throw new Error('Missing OAuth authorize_url');
		if (!access_url) throw new Error('Missing OAuth access_url');
		if (!profile_url) throw new Error('Missing OAuth profile_url');

		// get live config
		const config = context.app.get('authentication');

		if (config?.oauth) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const tmpconf: any = config.oauth || {};

			tmpconf[tenantId] = {
			// tmpconf['tenant'] = {
				'oauth': 2,
				'key': key,
				'client_id': key,
				'secret': secret,
				'scope': scope,
				'authorize_url': authorize_url,
				'access_url': access_url,
				'profile_url': profile_url,
				'redirect_uri': redirect_uri,
				'scope_delimiter': scope_delimiter,
				'name_parameter': name_parameter,
				'token_endpoint_auth_method': 'client_secret_basic'
			};
			config.oauth = tmpconf;
			// update config 
			context.app.set('authentication', config);
			// delete oauth 
			context.app.unuse('oauth/:provider');
			// updateConfiguration
			context.app.configure(oauth());
			// re-add hooks
			context.app.service('oauth/:provider').hooks(
				{ 
					before: { find: [ dynamicOAuth ] },
				});
			// halt hooks since they will fail
			throw new Error('Reloading configuration try again!');
		}
		
	} else {
		// tenant found no problem
		context.params.route.provider = tenantId;
	}

};