import { HookContext } from '../declarations';

export const dynamicOAuth = async (context: HookContext) => {
	const { tenantId } = context.params.query;

	if (!tenantId) throw new Error('Missing tenantId');

	const { total, data } = await context.app.service('tenantOAuths').find({ query: { tenantId } });

	if (total === 0) throw new Error('Missing OAuth configuration');

	// eslint-disable-next-line camelcase
	const { key, secret, authorize_url, access_url, profile_url, scope, scope_delimiter } = data[0];

	if (!key) throw new Error('Missing OAuth key');
	if (!secret) throw new Error('Missing OAuth secret');
	if (!scope) throw new Error('Missing OAuth scope');
	// eslint-disable-next-line camelcase
	if (!authorize_url) throw new Error('Missing OAuth authorize_url');
	// eslint-disable-next-line camelcase
	if (!access_url) throw new Error('Missing OAuth access_url');
	// eslint-disable-next-line camelcase
	if (!profile_url) throw new Error('Missing OAuth profile_url');
	// eslint-disable-next-line camelcase
	if (!scope_delimiter) throw new Error('Missing OAuth scope_delimiter');

	context.params.query.key = key;
	context.params.query.secret = secret;
	context.params.query.scope = scope;
	// eslint-disable-next-line camelcase
	context.params.query.authorize_url = authorize_url;
	// eslint-disable-next-line camelcase
	context.params.query.access_url = access_url;
	// eslint-disable-next-line camelcase
	context.params.query.profile_url = profile_url;
	// eslint-disable-next-line camelcase
	context.params.query.scope_delimiter = scope_delimiter;
};