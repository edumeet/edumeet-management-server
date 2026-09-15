import { AuthenticationResult, AuthenticationService } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';

export class EdumeetAuthenticationService extends AuthenticationService {
	async getPayload(authResult: AuthenticationResult, params: Params) {
		const payload = await super.getPayload(authResult, params);

		// eslint-disable-next-line camelcase
		return { ...payload, auth_time: Math.floor(Date.now() / 1000) };
	}
}
