import { BadRequest } from '@feathersjs/errors';
import { HookContext } from '../declarations';

/**
 * Gain rules can no longer make anyone super admin, for anyone, super admins included. A rule
 * lives in a tenant and matches what that tenant's identity provider sends, and the tenant's
 * admins control that provider, so they could always satisfy such a rule. Super admins are
 * made by another super admin, on the user.
 */
export const noSuperAdminRules = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const rows: Array<Record<string, unknown>> = Array.isArray(context.data) ? context.data : [ context.data ?? {} ];

	if (rows.some((row) => row.action === 'superAdmin'))
		throw new BadRequest('Rules can no longer grant super admin; make a user super admin directly');
};

// Kept for existing imports: the same check.
export const adminOnlyData = noSuperAdminRules;
