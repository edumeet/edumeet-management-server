import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';
import { notSuperAdmin } from './notSuperAdmin';

/**
 * A group grants room roles inside its own tenant, so putting a user of another
 * tenant into it is a privilege escalation. Enforced on `groupUsers` create.
 *
 * Two exemption rules, and the difference between them matters:
 *
 * - An external caller who is a **super admin** is exempt. They manage every
 *   tenant, so a deliberate cross-tenant assignment is theirs to make.
 * - An **internal** call is NOT exempt, even though `notSuperAdmin()` reports
 *   false for it. The internal caller here is `gainRules`, acting on a rule that
 *   a tenant admin authored - a rule's `accessId` is not validated against its
 *   tenant, so without this check a tenant admin could name any group id and
 *   have their users added to another tenant's group.
 */
// A bigint column arrives as a string from node-postgres and as a number from
// mysql2, and "no tenant" arrives as either null or undefined. Fold all of that
// into one comparable token.
const tenantKey = (value: unknown): string => (value == null ? '' : String(value));

export const groupAndUserInSameTenant = async (context: HookContext): Promise<void> => {
	if (context.params.provider && !notSuperAdmin()(context)) return;

	// create() also accepts an array for a bulk insert, so every row has to be
	// checked - otherwise posting an array would be a way around this hook.
	const rows = Array.isArray(context.data) ? context.data : [ context.data ];

	const internal = { provider: undefined, query: {} };

	for (const row of rows) {
		const { groupId, userId } = row ?? {};

		// Missing ids are the data validator's problem, not ours.
		if (groupId == null || userId == null) continue;

		const [ group, user ] = await Promise.all([
			context.app.service('groups').get(groupId, internal),
			context.app.service('users').get(userId, internal)
		]);

		if (tenantKey(group?.tenantId) !== tenantKey(user?.tenantId)) {
			throw new Forbidden('The group and the user must belong to the same tenant');
		}
	}
};
