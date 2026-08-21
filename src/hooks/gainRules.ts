import { HookContext } from '../declarations';
import { logger } from '../logger';
import { MatchableRule, asArray, findTenantRules, logUnevaluatableRule, matchRule } from './ruleMatch';

interface GainRule extends MatchableRule {
	action?: string | null;
	accessId?: string | null;
}

export const GAIN_ACTIONS = [ 'groupUsers', 'tenantOwners', 'tenantAdmins', 'superAdmin' ] as const;

/**
 * Add the user to a tenantOwners/tenantAdmins table, unless they are in it already.
 */
const grantTenantRole = async (
	context: HookContext,
	service: 'tenantOwners' | 'tenantAdmins',
	userId: number,
	tenantId: number
): Promise<void> => {
	const existing = asArray(await context.app.service(service).find({
		paginate: false, // Fetch all relevant records
		query: { tenantId, userId }
	}));

	if (existing.length === 0)
		await context.app.service(service).create({ tenantId, userId });
};

const applyGain = async (
	context: HookContext,
	rule: GainRule,
	userId: number,
	tenantId: number
): Promise<void> => {
	switch (rule.action) {
		case 'groupUsers': {
			// -> action db/service -> currentuser id + accessId assigment
			const groupId = rule.accessId == null ? NaN : parseInt(rule.accessId);

			if (Number.isNaN(groupId)) {
				logger.warn(
					'gainRules: rule (id:%s name:%s) has action groupUsers but no usable accessId (group) "%s"',
					rule.id, rule.name, rule.accessId
				);
				break;
			}

			const existing = asArray(await context.app.service('groupUsers').find({
				paginate: false, // Fetch all relevant records
				query: { groupId, userId }
			}));

			if (existing.length === 0)
				await context.app.service('groupUsers').create({ groupId, userId });

			break;
		}
		case 'tenantOwners': {
			// Make user tenant Owner (tenant owner table)
			await grantTenantRole(context, 'tenantOwners', userId, tenantId);
			break;
		}
		case 'tenantAdmins': {
			// Make user tenant Admin (tenant admin table)
			await grantTenantRole(context, 'tenantAdmins', userId, tenantId);
			break;
		}
		case 'userRole': {
			// TODO
			logger.warn('gainRules: rule (id:%s name:%s) uses action userRole, which is not implemented', rule.id, rule.name);
			break;
		}
		case 'superAdmin': {
			// Make user super-admin (user table)
			const roles = context.result.roles;
			const alreadySuperAdmin = roles != null && roles.includes('super-admin');

			if (!alreadySuperAdmin) {
				// This patch re-enters this hook, but its data carries no tenantId so the
				// guard at the top of gainRules() stops it immediately.
				if (context.app.get('postgresql')?.client == 'mysql2')
					await context.app.service('users').patch(userId, { roles: [ '["super-admin"]' ] });
				else
					await context.app.service('users').patch(userId, { roles: [ 'super-admin' ] });
			}

			break;
		}
		default: {
			logger.warn(
				'gainRules: rule (id:%s name:%s) has unknown action "%s", expected one of %s',
				rule.id, rule.name, rule.action, GAIN_ACTIONS.join(', ')
			);
			break;
		}
	}
};

/**
 * Auto-provisioning for user accounts. Registered on `after.all` of the users
 * service; it runs for `create` (first SSO login) and for `patch`, which is what
 * OAuthStrategy.updateEntity does on every subsequent login - that is what keeps
 * group membership in sync for returning users.
 */
export const gainRules = async (context: HookContext): Promise<void> => {
	// ignore tenantid for local admin
	if (!context.data?.tenantId) return;

	// Only create/patch produce a user to grant anything to.
	if (context.method !== 'create' && context.method !== 'patch') return;

	// A multi-patch resolves to an array of users, so there is no single subject.
	if (!context.result || Array.isArray(context.result) || context.result.id == null) return;

	const userId = parseInt(context.result.id);
	const tenantId = parseInt(context.data.tenantId);

	if (Number.isNaN(userId) || Number.isNaN(tenantId)) return;

	const rulesService = context.app.service('rules');

	const rules = await findTenantRules(
		// Fetch all relevant records
		(query) => rulesService.find({ paginate: false, query }),
		'gainRules',
		tenantId,
		[ 'gain' ]
	) as GainRule[];

	if (rules.length === 0) return;

	for (const rule of rules) {
		const condition = matchRule(rule, context.data);

		if (condition === undefined) {
			logUnevaluatableRule('gainRules', rule);
			continue;
		}

		if (!condition) continue;

		// A grant that fails must not break the login that triggered it, so each rule
		// is isolated and its failure is logged rather than propagated.
		try {
			await applyGain(context, rule, userId, tenantId);
		} catch (error) {
			logger.error(
				'gainRules: rule (id:%s name:%s tenantId:%s action:%s) failed for user %s [error:%o]',
				rule.id, rule.name, rule.tenantId, rule.action, userId, error
			);
		}
	}
};
