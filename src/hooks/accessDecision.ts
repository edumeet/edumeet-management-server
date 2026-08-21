import { Application } from '../declarations';
import { logger } from '../logger';
import {
	ACCESS_TYPES,
	MatchableRule,
	asArray,
	findTenantRules,
	logUnevaluatableRule,
	matchRule,
	ruleLevel
} from './ruleMatch';

export interface AccessDecision {
	permitted: boolean;
	// the rule that decided, when one did
	rule?: MatchableRule;
}

/**
 * Decide whether a set of user attributes may sign in under a tenant's rules.
 *
 *     the most specific matching rule decides
 *     a Block wins a tie at the same level
 *     nothing matched at all -> permit
 *
 * Specificity (see ruleLevel) is what lets a tenant state its own default as an
 * ordinary rule: `Block anyone` sits at level 0, so it applies only to people no
 * real rule mentions. Its presence closes the tenant, its absence leaves it open,
 * and either way an admin can see the row rather than having to infer it.
 *
 * That also makes exceptions work in both directions. `Block ends with @gmail.com`
 * plus `Allow equals someone@gmail.com` admits that one address, because naming a
 * person outranks describing a group. `Allow ends with @acme.edu` plus
 * `Block ends with @students.acme.edu` still refuses the students, because two
 * groups tie and Block breaks it.
 *
 * A rule that cannot be evaluated - unknown method, or a parameter the login does
 * not carry - is skipped and never decides.
 */
export const decideAccess = (
	rules: MatchableRule[],
	attributes: Record<string, unknown>,
	hookName = 'accessRules'
): AccessDecision => {
	let decided: MatchableRule | undefined;
	let decidedLevel = -1;
	let decidedBlocks = false;

	for (const rule of rules) {
		// Only access rules decide access. loadAccessRules already filters, but this
		// must not depend on that: treating "anything that is not a block" as an allow
		// would let a grant rule, or a row with a typo in its type, decide a login.
		if (rule.type !== 'block' && rule.type !== 'allow') continue;

		const matched = matchRule(rule, attributes);

		if (matched === undefined) {
			logUnevaluatableRule(hookName, rule);
			continue;
		}

		if (!matched) continue;

		const level = ruleLevel(rule);
		const blocks = rule.type === 'block';

		if (level > decidedLevel || (level === decidedLevel && blocks && !decidedBlocks)) {
			decided = rule;
			decidedLevel = level;
			decidedBlocks = blocks;
		}
	}

	// No rule says anything about this person, so nothing stands in their way. A
	// tenant that wants the opposite says so with a `Block anyone` rule.
	if (!decided) return { permitted: true };

	return { permitted: !decidedBlocks, rule: decided };
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
