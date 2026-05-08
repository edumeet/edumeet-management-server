import { OAuthProfile, OAuthStrategy } from '@feathersjs/authentication-oauth/lib';
import { AuthenticationRequest, AuthenticationResult } from '@feathersjs/authentication/lib';
import { Params } from '@feathersjs/feathers';
import qs from 'qs';

export default class OAuthTenantStrategy extends OAuthStrategy {
	// Capture the OIDC id_token from the raw grant response so it can be
	// forwarded to the client and used as id_token_hint at logout time
	// (required by spec-strict OPs when post_logout_redirect_uri is sent).
	async authenticate(authentication: AuthenticationRequest, originalParams: Params) {
		const result = await super.authenticate(authentication, originalParams);

		if (authentication?.id_token) {
			(result as AuthenticationResult).idToken = authentication.id_token;
		}

		return result;
	}

	// name attribute can come from displayName or sn + givenName
	async getEntityQuery(profile: OAuthProfile, params: Params) {
		if (profile?.error)	throw new Error(profile.error);
		// if (!profile?.email || !params?.query?.tenantId) return {};// throw new Error('Missing paramenter(s)');
		// const paramKey = params?.query?.name_parameter;
		// const name = (paramKey ? profile[paramKey] : null) || profile.name || profile.email || '';
		
		const ssoId = profile?.sub || profile?.id || undefined;

		if (ssoId) {
			return {
				ssoId: profile?.sub || profile?.id || undefined,
				tenantId: parseInt(params.query?.tenantId),
			};
		}

		return {
			tenantId: parseInt(params.query?.tenantId),
		};
	}

	// Fall back to (tenantId, email) when the ssoId lookup misses. Handles IdP
	// migrations / user recreations where an existing user gets a new `sub`:
	// without this, the create-path runs and trips the (tenantId, email) unique
	// constraint. On a hit, getEntityData rewrites ssoId to the new value.
	async findEntity(profile: OAuthProfile, params: Params) {
		const found = await super.findEntity(profile, params);

		if (found || !profile?.email || !params.query?.tenantId) return found;

		const result = await this.entityService.find({
			...params,
			query: {
				tenantId: parseInt(params.query.tenantId),
				email: profile.email,
				$limit: 1,
			},
			provider: undefined,
		});

		return Array.isArray(result) ? result[0] : result.data?.[0];
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async getEntityData(profile: OAuthProfile, _existingEntity: any, params: Params) {
		if (!profile?.email || !params?.query?.tenantId) throw new Error('Missing paramenter(s)');
		const paramKey = params?.query?.name_parameter;
		const name = (paramKey ? profile[paramKey] : null) || profile.name || profile.email || '';

		return {
			ssoId: profile.sub || profile.id,
			email: profile.email,
			name: name,
			tenantId: parseInt(params.query?.tenantId),
		};
	}

	async getRedirect(
		data: AuthenticationResult | Error
	): Promise<string | null> {
		const redirectUrl = '/auth/callback?';
		const authResult: AuthenticationResult = data;
		const query = authResult.accessToken
			// eslint-disable-next-line camelcase
			? { access_token: authResult.accessToken, ...(authResult.idToken && { id_token: authResult.idToken }) }
			: { error: data.message || 'OAuth Authentication not successful' };

		return `${redirectUrl}${qs.stringify(query)}`;
	}
}