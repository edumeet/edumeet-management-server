import { BadRequest, Forbidden } from '@feathersjs/errors';
import type { HookContext } from '../declarations';
import { notSuperAdmin } from './notSuperAdmin';

// Super admins and the tenant's admins and owners see every user's name and e-mail.
export const canSeeAllUsers = (context: HookContext): boolean => {
	const user = context.params.user;

	return Boolean(user) && (!notSuperAdmin()(context) || Boolean(user.tenantAdmin) || Boolean(user.tenantOwner));
};

// In a tenant that hides user details, knowing a user's exact e-mail address is what lets
// someone see that user's name. So a resolution may only be stored for a user the caller
// has just found by that address; the server remembers those lookups for a while.
const LOOKUP_TTL_MS = 10 * 60 * 1000;
const lookups = new Map<string, Map<string, number>>();

const sweep = (now: number) => {
	for (const [ caller, found ] of lookups) {
		for (const [ id, expires ] of found) if (expires <= now) found.delete(id);
		if (found.size === 0) lookups.delete(caller);
	}
};

export const rememberEmailLookup = (callerId: unknown, foundIds: unknown[]): void => {
	if (foundIds.length === 0) return;

	const now = Date.now();

	sweep(now);

	const found = lookups.get(String(callerId)) ?? new Map<string, number>();

	for (const id of foundIds) found.set(String(id), now + LOOKUP_TTL_MS);
	lookups.set(String(callerId), found);
};

export const lookedUpByEmail = (callerId: unknown, userId: unknown): boolean =>
	(lookups.get(String(callerId))?.get(String(userId)) ?? 0) > Date.now();

const emailOnlyExact = (query: unknown): boolean => {
	if (typeof query !== 'object' || query === null) return true;

	const { email, $sort, $or, $and } = query as Record<string, unknown>;

	if (email !== undefined && typeof email !== 'string') return false;
	if (typeof $sort === 'object' && $sort !== null && 'email' in $sort) return false;

	return [ $or, $and ].every((list) => list === undefined || (Array.isArray(list) && list.every(emailOnlyExact)));
};

// users before hook: comparison operators or sorting on e-mail would let someone narrow
// down addresses they do not know, one query at a time.
export const exactEmailQueriesOnly = async (context: HookContext): Promise<HookContext> => {
	if (!context.params.provider || canSeeAllUsers(context)) return context;

	if (!emailOnlyExact(context.params.query))
		throw new BadRequest('Users can only be looked up by their exact e-mail address');

	return context;
};

// resolvedUsers before create hook, after userId was set from the caller.
export const onlyLookedUpUsers = async (context: HookContext): Promise<HookContext> => {
	if (!context.params.provider || canSeeAllUsers(context)) return context;

	const { resolvedUserId } = (context.data ?? {}) as { resolvedUserId?: unknown };

	if (!lookedUpByEmail(context.params.user?.id, resolvedUserId))
		throw new Forbidden('Look the user up by e-mail address first');

	return context;
};
