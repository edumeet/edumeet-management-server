/* eslint-disable camelcase */
import { HookContext } from '../declarations';

export const dynamicOAuth = async (context: HookContext) => {
	const { tenantId } = context.params.query;

	if (!tenantId) throw new Error('Missing tenantId');

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
		scope_delimiter = ' '
	} = data[0];

	if (!key) throw new Error('Missing OAuth key');
	if (!secret) throw new Error('Missing OAuth secret');
	if (!authorize_url) throw new Error('Missing OAuth authorize_url');
	if (!access_url) throw new Error('Missing OAuth access_url');
	if (!profile_url) throw new Error('Missing OAuth profile_url');

	context.params.query.key = key;
	context.params.query.secret = secret;
	context.params.query.scope = scope;
	context.params.query.authorize_url = authorize_url;
	context.params.query.access_url = access_url;
	context.params.query.profile_url = profile_url;
	context.params.query.redirect_uri = redirect_uri;
	context.params.query.scope_delimiter = scope_delimiter;
};