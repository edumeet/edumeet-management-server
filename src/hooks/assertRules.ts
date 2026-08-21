import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';
import { logger } from '../logger';
import { findTenantRules, logUnevaluatableRule, matchRule } from './ruleMatch';

/**
 * Deny-list for user provisioning. Registered on `before.create` of the users
 * service, so it gates the creation of a new account (typically the first SSO
 * login of a user). It deliberately does NOT run on subsequent logins - those
 * patch an existing user - so accounts already provisioned, including ones added
 * manually, keep working.
 */
export const assertRules = async (context: HookContext): Promise<void> => {
	// ignore tenantid for local admin
	if (!context.data?.tenantId) return;

	const tenantId = parseInt(context.data.tenantId);

	if (Number.isNaN(tenantId)) return;

	const rulesService = context.app.service('rules');

	const rules = await findTenantRules(
		// Fetch all relevant records
		(query) => rulesService.find({ paginate: false, query }),
		'assertRules',
		tenantId,
		'assert'
	);

	if (rules.length === 0) return;

	for (const rule of rules) {
		const condition = matchRule(rule, context.data);

		if (condition === undefined) {
			logUnevaluatableRule('assertRules', rule);
			continue;
		}

		if (condition) {
			// user creation is not allowed contact Administrator
			logger.info(
				'assertRules: blocking user creation in tenant %s by rule (id:%s name:%s)',
				context.data.tenantId, rule.id, rule.name
			);

			throw new Forbidden('Action not allowed by rule');
		}
	}
};
