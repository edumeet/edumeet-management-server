import { OAuthProfile, OAuthStrategy } from '@feathersjs/authentication-oauth/lib';
import { AuthenticationResult, AuthenticationParams } from '@feathersjs/authentication/lib';
import { NotAuthenticated } from '@feathersjs/errors/lib';
import { Params } from '@feathersjs/feathers';
import qs from 'qs';

export default class OAuthTenantStrategy extends OAuthStrategy {
	async getEntityQuery(profile: OAuthProfile, params: Params) {
		if (!profile.email || !params?.query?.tenantId) throw new Error('Missing paramenter(s)');

		return {
			ssoId: profile.sub || profile.id,
			email: profile.email,
			tenantId: parseInt(params.query?.tenantId),
		};
	}

	async getEntityData(profile: OAuthProfile, _existingEntity: any, params: Params) {
		if (!profile.email || !params?.query?.tenantId) throw new Error('Missing paramenter(s)');

		return {
			ssoId: profile.sub || profile.id,
			email: profile.email,
			tenantId: parseInt(params.query?.tenantId),
		};
	}

	async getRedirect(
		data: AuthenticationResult | Error,
		params?: AuthenticationParams
	): Promise<string | null> {
		const queryRedirect = params?.redirect || '';
		const redirect = await this.getAllowedOrigin(params);
	
		if (!redirect) return null;
	
		const redirectUrl = `${redirect}${queryRedirect}/auth/callback?`;
		const authResult: AuthenticationResult = data;
		// eslint-disable-next-line camelcase
		const query = authResult.accessToken ? { access_token: authResult.accessToken } : { error: data.message || 'OAuth Authentication not successful' };
	
		return `${redirectUrl}${qs.stringify(query)}`;
	}
}