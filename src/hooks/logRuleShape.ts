import { HookContext } from '../declarations';
import { logger } from '../logger';
import { GAIN_ACTIONS } from './gainRules';
import { RULE_METHODS, RULE_TYPES } from './ruleMatch';

// The only fields OAuthTenantStrategy.getEntityData() puts on the user data, and
// therefore the only values of `parameter` a rule can ever match on at SSO login.
export const RULE_PARAMETERS = [ 'email', 'name', 'ssoId', 'tenantId' ] as const;

const isOneOf = (value: unknown, allowed: readonly string[]): boolean =>
	typeof value === 'string' && allowed.includes(value);

/**
 * Report a rule that is saved in a shape that can never do anything.
 *
 * These are warnings, not errors: `type`, `method` and `action` are plain strings
 * in the schema so that rows predating any given list keep validating. Catching a
 * typo here means an admin learns about it when they save, rather than never.
 */
export const logRuleShape = async (context: HookContext): Promise<void> => {
	for (const data of (Array.isArray(context.data) ? context.data : [ context.data ])) {
		if (data) logOne(data);
	}
};

// A patch may carry only some of the fields, so every check is skipped unless the
// field it needs is actually part of this write. Warning about a field the caller
// never sent would be a false alarm.
const logOne = (data: Record<string, unknown>): void => {
	const label = `rule "${data.name ?? ''}" (tenantId:${data.tenantId})`;

	if (data.type !== undefined && !isOneOf(data.type, RULE_TYPES)) {
		logger.warn(
			'rules: %s has type "%s", so it will never run - expected one of %s',
			label, data.type, RULE_TYPES.join(', ')
		);
	}

	// On an ACCESS rule a negated condition is a mistake: the direction is carried by
	// block/allow, and negated allows compose wrongly (two of them exclude nobody).
	// The migration clears it, so seeing one means the row was written directly.
	//
	// On a GRANT rule it is legitimate and permanent - "grant to everyone except X"
	// has no other spelling - so it is not warned about, merely no longer offered in
	// the dialog.
	if (data.negate && (data.type === 'block' || data.type === 'allow')) {
		logger.warn(
			'rules: %s is an access rule with a negated condition, which no longer has a meaning - use a block rule or an allow rule instead',
			label
		);
	}

	if (data.method !== undefined && !isOneOf(data.method, RULE_METHODS)) {
		logger.warn(
			'rules: %s has method "%s", so it will never match - expected one of %s',
			label, data.method, RULE_METHODS.join(', ')
		);
	}

	if (data.parameter !== undefined && !isOneOf(data.parameter, RULE_PARAMETERS)) {
		logger.warn(
			'rules: %s tests parameter "%s", which SSO logins do not carry - expected one of %s',
			label, data.parameter, RULE_PARAMETERS.join(', ')
		);
	}

	if (data.type === 'gain' && 'action' in data && !isOneOf(data.action, GAIN_ACTIONS)) {
		logger.warn(
			'rules: %s is a gain rule with action "%s", so it will grant nothing - expected one of %s',
			label, data.action, GAIN_ACTIONS.join(', ')
		);
	}

	if (data.action === 'groupUsers' && 'accessId' in data && !data.accessId) {
		logger.warn('rules: %s grants group membership but names no group in accessId', label);
	}
};
