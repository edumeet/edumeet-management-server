import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';
import { isAccessPermitted } from './accessDecision';

/**
 * Access control for account creation. Registered on `before.create` of the users
 * service, so it covers accounts an admin creates directly.
 *
 * The SSO path is gated earlier, in OAuthTenantStrategy.getEntityData(), which runs
 * for both first registration and every subsequent login. This hook is what keeps
 * non-SSO account creation subject to the same rules.
 */
export const accessRules = async (context: HookContext): Promise<void> => {
	// ignore tenantid for local admin
	if (!context.data?.tenantId) return;

	const tenantId = parseInt(context.data.tenantId);

	if (Number.isNaN(tenantId)) return;

	const permitted = await isAccessPermitted(context.app, tenantId, context.data, 'accessRules');

	if (!permitted) {
		// user creation is not allowed contact Administrator
		throw new Forbidden('Action not allowed by rule');
	}
};
