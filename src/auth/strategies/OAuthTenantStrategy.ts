import { OAuthProfile, OAuthStrategy } from '@feathersjs/authentication-oauth/lib';
import { Params } from '@feathersjs/feathers';

export default class OAuthTenantStrategy extends OAuthStrategy {
	async getEntityQuery(profile: OAuthProfile, params: Params) {
		if (!profile.email || !params?.query?.tenantId) throw new Error('Missing paramenter(s)');

		return {
			// [`${this.name}Id`]: profile.sub || profile.id,
			ssoId: profile.sub || profile.id,
			email: profile.email,
			tenantId: parseInt(params.query?.tenantId),
		};
	}

	async getEntityData(profile: OAuthProfile, _existingEntity: any, params: Params) {
		if (!profile.email || !params?.query?.tenantId) throw new Error('Missing paramenter(s)');

		return {
			// [`${this.name}Id`]: profile.sub || profile.id,
			ssoId: profile.sub || profile.id,
			email: profile.email,
			tenantId: parseInt(params.query?.tenantId),
		};
	}
}