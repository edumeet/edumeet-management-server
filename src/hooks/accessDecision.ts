import { Application } from '../declarations';
import { logger } from '../logger';
import {
	ACCESS_TYPES,
	MatchableRule,
	asArray,
	findTenantRules,
	logUnevaluatableRule,
	matchRule
} from './ruleMatch';

export interface AccessDecision {
	permitted: boolean;
	// the rule that decided, when one did
	rule?: MatchableRule;
}

/**
 * Decide whether a set of user attributes may sign in under a tenant's rules.
 *
 *     if   any Block matches                  -> deny
 *     elif no evaluatable Allow rule exists   -> permit
 *     elif any Allow matches                  -> permit
 *     else                                    -> deny
 *
 * Block wins outright, so a targeted block is never defeated by a broad allow.
 * The two types compose in opposite directions on purpose: blocks are AND-ed
 * (deny if any matches), allows are OR-ed (permit if any matches), which is why
 * a block cannot be expressed as "an allow with a negated condition".
 *
 * The `evaluatable` qualifier is load bearing. `matchRule` returns undefined for a
 * rule whose parameter is absent or whose method is unknown, and such a rule is
 * skipped. If it still counted towards "an Allow rule exists", a tenant whose only
 * allow rule has a typo would fall through to deny and lock everybody out. Counting
 * only rules we could actually evaluate keeps a typo fail-open.
 */
export const decideAccess = (
	rules: MatchableRule[],
	attributes: Record<string, unknown>,
	hookName = 'accessRules'
): AccessDecision => {
	let evaluatableAllows = 0;
	let matchedAllow: MatchableRule | undefined;

	for (const rule of rules) {
		// Only access rules decide access. loadAccessRules already filters, but this
		// must not depend on that: treating "anything that is not a block" as an allow
		// would let a grant rule, or a row with a typo in its type, close the tenant.
		if (rule.type !== 'block' && rule.type !== 'allow') continue;

		const matched = matchRule(rule, attributes);

		if (matched === undefined) {
			logUnevaluatableRule(hookName, rule);
			continue;
		}

		if (rule.type === 'block') {
			if (matched) return { permitted: false, rule };

			continue;
		}

		evaluatableAllows++;
		if (matched && !matchedAllow) matchedAllow = rule;
	}

	if (evaluatableAllows === 0) return { permitted: true };

	return matchedAllow ? { permitted: true, rule: matchedAllow } : { permitted: false };
};

/**
 * Load a tenant's access rules. Kept separate from decideAccess so the decision
 * itself stays pure and testable without a database.
 */
export const loadAccessRules = async (app: Application, tenantId: number, hookName: string): Promise<MatchableRule[]> => {
	const rulesService = app.service('rules');

	return findTenantRules(
		// Fetch all relevant records
		(query) => rulesService.find({ paginate: false, query }),
		hookName,
		tenantId,
		ACCESS_TYPES
	);
};

// roles is a VARCHAR[] on Postgres and a json column on MySQL, and has been seen as
// a JSON string. Mirrors the parsing in hooks/notSuperAdmin.ts.
const isSuperAdmin = (roles: unknown): boolean => {
	if (roles == null) return false;

	let list: unknown = roles;

	if (typeof list === 'string') {
		try {
			list = JSON.parse(list);
		} catch {
			return list === 'super-admin' || (list as string).includes('super-admin');
		}
	}

	return Array.isArray(list) && list.some((r) => r === 'super-admin' || r === 'edumeet-server');
};

/**
 * Administrators are never refused by access rules.
 *
 * Without this a tenant admin can lock themselves, and everyone who could undo it,
 * out of their own tenant with one careless rule - and the rules are edited through
 * the very interface they would lose. The exemption covers the super admin, and the
 * admins and owners of the tenant being entered.
 *
 * A brand new account cannot be any of those, so this only ever matters for someone
 * who already exists.
 */
export const isExemptFromAccessRules = async (
	app: Application,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	user: any,
	tenantId: number
): Promise<boolean> => {
	if (!user) return false;
	if (isSuperAdmin(user.roles)) return true;

	const userId = parseInt(String(user.id));

	if (Number.isNaN(userId) || Number.isNaN(tenantId)) return false;

	for (const service of [ 'tenantAdmins', 'tenantOwners' ] as const) {
		const rows = asArray(await app.service(service).find({
			paginate: false, // Fetch all relevant records
			query: { tenantId, userId }
		}));

		if (rows.length > 0) return true;
	}

	return false;
};

/**
 * Load and decide in one step, logging the refusal. Returns true when the sign in
 * or account creation may proceed.
 *
 * `user` is the existing account, when there is one. It is only consulted for a
 * decision that came out as a refusal, so the administrator lookup costs nothing
 * for the users who are being let in anyway.
 */
export const isAccessPermitted = async (
	app: Application,
	tenantId: number,
	attributes: Record<string, unknown>,
	hookName: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	user?: any
): Promise<boolean> => {
	const rules = await loadAccessRules(app, tenantId, hookName);

	if (rules.length === 0) return true;

	const decision = decideAccess(rules, attributes, hookName);

	if (decision.permitted) return true;

	if (await isExemptFromAccessRules(app, user, tenantId)) {
		logger.info(
			'%s: rules would refuse %s in tenant %s, but administrators are exempt',
			hookName, attributes.email ?? user?.id, tenantId
		);

		return true;
	}

	logger.info(
		'%s: refusing tenant %s by rule (id:%s name:%s type:%s)',
		hookName, tenantId, decision.rule?.id ?? 'none', decision.rule?.name ?? '', decision.rule?.type ?? 'no allow rule matched'
	);

	return false;
};
