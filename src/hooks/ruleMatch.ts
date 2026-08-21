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

export const RULE_METHODS = [ 'contains', 'equals', 'startswith', 'endswith' ] as const;
export const RULE_TYPES = [ 'assert', 'gain' ] as const;

/**
 * `find({ paginate: false })` resolves to a plain array, but the service types
 * still describe the paginated union. Normalise so callers can just use .length.
 */
export function asArray<T>(result: T[] | { data: T[] }): T[] {
	return Array.isArray(result) ? result : result.data;
}

/**
 * Fetch the rules of one type for a tenant.
 *
 * It queries the tenant's rules without a `type` filter on purpose: a rule whose
 * type is neither `assert` nor `gain` matches neither hook's query, so filtering
 * in the database would make it invisible - it would simply never run and never
 * say why. Selecting the type here lets us report those rules instead.
 */
export const findTenantRules = async (
	// eslint-disable-next-line no-unused-vars
	find: (query: Record<string, unknown>) => Promise<unknown>,
	hookName: string,
	tenantId: number,
	type: typeof RULE_TYPES[number]
): Promise<MatchableRule[]> => {
	const all = asArray(await find({ tenantId }) as MatchableRule[]);
	const wanted: MatchableRule[] = [];

	for (const rule of all) {
		if (rule.type === type) {
			wanted.push(rule);
		} else if (!RULE_TYPES.includes(rule.type as typeof RULE_TYPES[number])) {
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
