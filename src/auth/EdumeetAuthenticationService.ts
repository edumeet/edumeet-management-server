import { AuthenticationResult, AuthenticationService } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';

// The room servers take a user's token only at the addresses of this tenant. null for a user
// without a tenant (a super admin).
export const tokenTenant = (user?: { tenantId?: unknown } | null): number | null =>
	(user?.tenantId === undefined || user?.tenantId === null ? null : Number(user.tenantId));

export class EdumeetAuthenticationService extends AuthenticationService {
	async getPayload(authResult: AuthenticationResult, params: Params) {
		const payload = await super.getPayload(authResult, params);

		// eslint-disable-next-line camelcase
		return { ...payload, auth_time: Math.floor(Date.now() / 1000), tenantId: tokenTenant(authResult.user) };
	}
}
