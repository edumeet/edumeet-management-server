import { AuthenticationResult, AuthenticationService } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';
import { isSuperAdmin } from '../hooks/accessDecision';

// The room servers take a user's token only at the addresses of the tenant named in it. null
// (super admins, the room servers' account) is taken at every tenant, 0 (any other user
// without a tenant) only at addresses without one. Without a user there is no claim, and the
// room servers count the token as a guest's.
export const tokenTenant = (user?: { tenantId?: unknown; roles?: unknown } | null): number | null | undefined => {
	if (!user) return undefined;
	if (user.tenantId !== undefined && user.tenantId !== null) return Number(user.tenantId);

	return isSuperAdmin(user.roles) ? null : 0;
};

export class EdumeetAuthenticationService extends AuthenticationService {
	async getPayload(authResult: AuthenticationResult, params: Params) {
		const payload = await super.getPayload(authResult, params);

		// eslint-disable-next-line camelcase
		return { ...payload, auth_time: Math.floor(Date.now() / 1000), tenantId: tokenTenant(authResult.user) };
	}
}
