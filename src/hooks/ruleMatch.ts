import { logger } from '../logger';

/**
 * The subset of a rule row that decides whether it matches. Every column in the
 * `rules` table is nullable (see migrations/20250226072156_add_rules.ts), so
 * nothing here can be assumed present.
 */
export interface MatchableRule {
	id?: number | string;
	name?: string | null;
	tenantId?: number | string | null;
	type?: string | null;
	parameter?: string | null;
	method?: string | null;
	// knex maps boolean to tinyint(1) on MySQL, and mysql2 hands that back as 0/1
	// rather than false/true, so this is read for truthiness and never compared
	negate?: boolean | number | null;
	value?: string | null;
}

// `anyone` is the catch-all: it tests nothing and always matches. It is how a
// tenant states its default as a visible rule rather than having it inferred.
export const RULE_METHODS = [ 'contains', 'equals', 'startswith', 'endswith', 'anyone' ] as const;

/**
 * How specifically a rule identifies someone. The most specific matching rule
 * decides, and Block wins a tie.
 *
 *   2  equals            names one person
 *   1  contains, starts/ends with, and any negated form   describes a group
 *   0  anyone            describes nobody in particular, so it always loses
 *
 * Level 0 is what lets `Block anyone` act as a default without overruling the real
 * rules above it. A negated `equals` ("does not equal") describes everyone bar one
 * person, so it ranks as a group rather than as an exact match.
 */
export const ruleLevel = (rule: MatchableRule): number => {
	if (rule.method === 'anyone') return 0;
	if (rule.method === 'equals' && !rule.negate) return 2;

	return 1;
};

// `block` and `allow` answer "may this person sign in"; `gain` answers "what do
// they get once they are in". They are two categories, not three alternatives.
export const RULE_TYPES = [ 'block', 'allow', 'gain' ] as const;
export const ACCESS_TYPES = [ 'block', 'allow' ] as const;

export type RuleType = typeof RULE_TYPES[number];

/**
 * `find({ paginate: false })` resolves to a plain array, but the service types
 * still describe the paginated union. Normalise so callers can just use .length.
 */
export function asArray<T>(result: T[] | { data: T[] }): T[] {
	return Array.isArray(result) ? result : result.data;
}

/**
 * Fetch the rules of the requested type(s) for a tenant.
 *
 * It queries the tenant's rules without a `type` filter on purpose: a rule whose
 * type is not one we recognise matches no hook's query, so filtering in the
 * database would make it invisible - it would simply never run and never say why.
 * Selecting the type here lets us report those rules instead.
 */
export const findTenantRules = async (
	// eslint-disable-next-line no-unused-vars
	find: (query: Record<string, unknown>) => Promise<unknown>,
	hookName: string,
	tenantId: number,
	types: readonly RuleType[]
): Promise<MatchableRule[]> => {
	const all = asArray(await find({ tenantId }) as MatchableRule[]);
	const wanted: MatchableRule[] = [];

	for (const rule of all) {
		if (types.includes(rule.type as RuleType)) {
			wanted.push(rule);
		} else if (!RULE_TYPES.includes(rule.type as RuleType)) {
			logger.warn(
				'%s: rule (id:%s name:%s tenantId:%s) has unknown type "%s" and will never run, expected one of %s',
				hookName, rule.id, rule.name, rule.tenantId, rule.type, RULE_TYPES.join(', ')
			);
		}
	}

	return wanted;
};

/**
 * Evaluate a rule against the incoming user data.
 *
 * Returns `true`/`false` for a rule that could be evaluated, and `undefined` when
 * it could not be - either the parameter is absent from the profile (typo in the
 * rule, or the IdP did not send the attribute) or the method is not one we know.
 *
 * `undefined` is deliberately distinct from `false`: `negate` must never turn an
 * unevaluatable rule into a match, otherwise a single typo on a negated assert
 * rule locks every user of the tenant out.
 */
export const matchRule = (rule: MatchableRule, data: Record<string, unknown>): boolean | undefined => {
	// The catch-all has no parameter by design, so it must be answered before the
	// missing-parameter check below. Otherwise every catch-all would be treated as
	// an unevaluatable rule and skipped, and an allow list would fail open.
	if (rule.method === 'anyone') return !rule.negate;

	const parameter = rule.parameter;

	if (!parameter) return undefined;

	const userParameter = data?.[parameter];

	if (userParameter === undefined || userParameter === null || userParameter === '')
		return undefined;

	// Attributes are not guaranteed to be strings (a numeric claim would blow up
	// on .includes/.startsWith), so compare on their string form.
	const haystack = String(userParameter);
	const needle = rule.value == null ? '' : String(rule.value);

	let condition: boolean;

	switch (rule.method) {
		case 'contains': {
			condition = haystack.includes(needle);
			break;
		}
		case 'equals': {
			condition = (haystack === needle);
			break;
		}
		case 'startswith': {
			condition = haystack.startsWith(needle);
			break;
		}
		case 'endswith': {
			condition = haystack.endsWith(needle);
			break;
		}
		default: {
			return undefined;
		}
	}

	return rule.negate ? !condition : condition;
};

/**
 * Explain why matchRule() returned undefined, so the warning tells an admin what
 * to go and fix.
 */
export const logUnevaluatableRule = (hookName: string, rule: MatchableRule): void => {
	const parameter = rule.parameter;

	if (!parameter) {
		logger.warn(
			'%s: skipping rule (id:%s name:%s tenantId:%s) - it has no parameter set',
			hookName, rule.id, rule.name, rule.tenantId
		);

		return;
	}

	if (!RULE_METHODS.includes(rule.method as typeof RULE_METHODS[number])) {
		logger.warn(
			'%s: skipping rule (id:%s name:%s tenantId:%s) - unknown method "%s", expected one of %s',
			hookName, rule.id, rule.name, rule.tenantId, rule.method, RULE_METHODS.join(', ')
		);

		return;
	}

	logger.warn(
		'%s: skipping rule (id:%s name:%s tenantId:%s) - parameter "%s" is not present on the user data',
		hookName, rule.id, rule.name, rule.tenantId, parameter
	);
};
