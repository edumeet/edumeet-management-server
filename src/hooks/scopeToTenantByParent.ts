import { Forbidden, NotFound } from '@feathersjs/errors';
import { HookContext } from '../declarations';

/**
 * `groupUsers`, `roomGroupRoles`, `rolePermissions` and `roomOwners` are join
 * tables with no `tenantId` column of their own, so the query resolver pattern
 * that scopes `groups` / `rooms` / `roles` / `users` to the caller's tenant
 * cannot be applied to them directly. What they had instead only validated a
 * foreign key that the caller had already supplied, and the management UI
 * issues a bare `find`, so nothing was constrained and a tenant admin got every
 * tenant's rows back. This hook derives the tenant boundary from the parent row
 * that the foreign key points at, and applies it whether or not the caller
 * asked for one.
 *
 * Two callers must NOT be scoped, and both are handled by wrapping this hook in
 * `iff(notSuperAdmin(), ...)` at the service:
 *
 * - A **super admin**, which includes the account the room servers log in with
 *   (`notSuperAdmin()` exempts `super-admin` and `edumeet-server` alike). They
 *   manage every tenant.
 * - An **internal** call, for which `notSuperAdmin()` reports false. The
 *   `owners` / `groupRoles` / `userRoles` virtuals on `rooms` are internal and
 *   carry no `params.user` to scope by, so filtering them would empty out every
 *   room the room server fetches through `getRoom()`.
 */

// A bigint column arrives as a string from node-postgres and as a number from
// mysql2, so ids are compared as strings. The raw values still go into the
// query, only the membership test is normalized.
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

		// `iff(notSuperAdmin())` only lets an external call that has a user
		// through, so this guards against a future miswiring rather than a
		// reachable path. Denying is the safe direction either way.
		if (tenantId == null)
			throw new Forbidden('Not allowed to read this collection');

		// Internal, so the parent's own hooks stay out of the way, and reduced to
		// the id: `rooms` resolves owners, group roles and user roles as virtuals,
		// and `resolveResult` only runs the properties named in `$select`, so this
		// stays one query instead of one per room.
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
			// Keep the caller's own operators and add ours, which knex ANDs
			// together. A caller supplied `$in` is intersected rather than
			// trusted: that is the case the old `typeof value === 'number'`
			// check let straight through.
			const requestedIn = (requested as { $in?: unknown[] }).$in;
			const narrowed = Array.isArray(requestedIn)
				? requestedIn.filter((value) => allowed.has(tenantKey(value)))
				: allowedIds;

			scoped = { ...requested, $in: narrowed };
		} else if (allowed.has(tenantKey(requested))) {
			scoped = requested;
		}

		const isEmpty = scoped === undefined ||
			(typeof scoped === 'object' && (scoped as { $in: unknown[] }).$in.length === 0);

		if (isEmpty) {
			// `get` merges `params.query` into its lookup, so an out of tenant id
			// would come back as "not found" anyway. Saying so explicitly keeps
			// the two methods from diverging.
			if (context.method === 'get')
				throw new NotFound(`No record found for id '${context.id}'`);

			context.result = { total: 0, data: [], limit: 0, skip: 0 };

			return;
		}

		context.params.query = { ...query, [key]: scoped };
	};
