import { Forbidden } from '@feathersjs/errors';
import { HookContext } from '../declarations';

/**
 * `groupUsers`, `roomGroupRoles`, `rolePermissions` and `roomOwners` are join
 * tables with no `tenantId` of their own, so the query resolver that scopes
 * `groups` / `rooms` / `roles` / `users` cannot be applied to them. This derives
 * the boundary from the parent row the foreign key points at, and applies it
 * whether or not the caller asked for one.
 *
 * Only ever wire this as `iff(notSuperAdmin(), ...)`. A super admin (which
 * includes the account the room servers log in with) manages every tenant, and
 * an internal call carries no `params.user` to scope by - filtering the `rooms`
 * virtuals would empty out every room the room server fetches.
 */

// bigint arrives as a string from node-postgres and a number from mysql2, so
// membership is tested on strings. Raw values still go into the query.
const tenantKey = (value: unknown): string => (value == null ? '' : String(value));

export interface ScopeToTenantByParentOptions {

	/** The foreign key column on the join table. */
	key: string;

	/** The service that owns the `tenantId` that key resolves to. */
	parentService: 'groups' | 'rooms' | 'roles';
}

export const scopeToTenantByParent = ({ key, parentService }: ScopeToTenantByParentOptions) =>
	async (context: HookContext): Promise<void> => {
		const tenantId = context.params.user?.tenantId;

		if (tenantId == null)
			throw new Forbidden('Not allowed to read this collection');

		// `$select` keeps this to one query: resolveResult only runs the properties
		// it names, so the `rooms` virtuals stay out of it.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const parent = context.app.service(parentService) as any;

		const parents: Array<{ id: unknown }> = await parent.find({
			paginate: false,
			provider: undefined,
			query: { tenantId, $select: [ 'id' ] }
		});

		const allowedIds = parents.map((row) => row.id);
		const allowed = new Set(allowedIds.map(tenantKey));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const query: Record<string, any> = context.params.query ?? {};
		const requested = query[key];

		let scoped: unknown;

		if (requested == null) {
			scoped = { $in: allowedIds };
		} else if (typeof requested === 'object') {
			// Keep the caller's operators and add ours, which knex ANDs together. A
			// supplied `$in` is intersected rather than trusted: that is the case the
			// old `typeof value === 'number'` check let straight through.
			const requestedIn = (requested as { $in?: unknown[] }).$in;
			const narrowed = Array.isArray(requestedIn)
				? requestedIn.filter((value) => allowed.has(tenantKey(value)))
				: allowedIds;

			scoped = { ...requested, $in: narrowed };
		} else if (allowed.has(tenantKey(requested))) {
			scoped = requested;
		}

		// Only ever constrain the query, never set `context.result`. These services
		// disagree on result shape - `roomGroupRoles` is `paginate: false` and returns
		// a bare array - and returning the wrong one crashed the client. An empty
		// `$in` compiles to `1 = 0` on both dialects, so the adapter builds the empty
		// result in its own shape and `get` raises NotFound by itself.
		context.params.query = { ...query, [key]: scoped ?? { $in: [] } };
	};
