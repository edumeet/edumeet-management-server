import assert from 'assert';
import type { HookContext } from '../../src/declarations';
import {
	exactEmailQueriesOnly,
	lookedUpByEmail,
	onlyLookedUpUsers,
	rememberEmailLookup
} from '../../src/hooks/userLookups';
import { ownTenantOnly } from '../../src/services/inviteTests/inviteTests';

const member = { id: 11, tenantId: 1, roles: [] as string[] };
const admin = { id: 12, tenantId: 1, tenantAdmin: true, roles: [] as string[] };

const context = (user: object | undefined, extra: Record<string, unknown> = {}): HookContext =>
	({ params: { provider: 'rest', user, query: {} }, ...extra }) as unknown as HookContext;

const withQuery = (user: object, query: unknown): HookContext => {
	const ctx = context(user);

	ctx.params.query = query as HookContext['params']['query'];

	return ctx;
};

describe('looking up users by e-mail', () => {
	it('lets a member find a user by the exact address only', async () => {
		await exactEmailQueriesOnly(withQuery(member, { email: 'a@acme.edu', $limit: 1, $sort: { id: 1 } }));

		for (const query of [
			{ email: { $gt: 'a' } },
			{ email: { $in: [ 'a@acme.edu', 'b@acme.edu' ] } },
			{ $sort: { email: 1 } },
			{ $or: [ { email: { $lt: 'm' } } ] },
			{ $and: [ { tenantId: 1 }, { $or: [ { email: { $ne: 'x' } } ] } ] },
		]) {
			await assert.rejects(exactEmailQueriesOnly(withQuery(member, query)), /exact e-mail address/, JSON.stringify(query));
		}
	});

	it('leaves admins and internal calls alone', async () => {
		await exactEmailQueriesOnly(withQuery(admin, { email: { $gt: 'a' } }));

		const internal = withQuery(member, { email: { $gt: 'a' } });

		internal.params.provider = undefined;
		await exactEmailQueriesOnly(internal);
	});
});

describe('resolving a user', () => {
	it('is refused for a user the caller did not find by e-mail, and allowed afterwards', async () => {
		await assert.rejects(onlyLookedUpUsers(context(member, { data: { resolvedUserId: 501 } })), /Look the user up/);

		rememberEmailLookup(member.id, [ 501 ]);
		await onlyLookedUpUsers(context(member, { data: { resolvedUserId: 501 } }));

		await assert.rejects(onlyLookedUpUsers(context(member, { data: { resolvedUserId: 502 } })), /Look the user up/);
		await assert.rejects(onlyLookedUpUsers(context({ ...member, id: 99 }, { data: { resolvedUserId: 501 } })), /Look the user up/);
	});

	it('is allowed for admins without a lookup', async () => {
		await onlyLookedUpUsers(context(admin, { data: { resolvedUserId: 777 } }));
	});

	it('forgets a lookup after ten minutes', () => {
		const realNow = Date.now;

		try {
			rememberEmailLookup(31, [ 601 ]);
			assert.strictEqual(lookedUpByEmail(31, 601), true);

			const later = realNow() + (10 * 60 * 1000) + 1;

			Date.now = () => later;
			assert.strictEqual(lookedUpByEmail(31, 601), false);
		} finally {
			Date.now = realNow;
		}
	});
});

describe('testing invitation mail settings', () => {
	it('keeps a tenant admin to their own tenant', async () => {
		await assert.rejects(ownTenantOnly(context(admin, { data: { tenantId: 2 } })), /your own tenant/);

		for (const data of [ undefined, {}, { tenantId: 1 }, { tenantId: '1' } ]) {
			const ctx = context(admin, { data });

			await ownTenantOnly(ctx);
			assert.strictEqual((ctx.data as { tenantId: number }).tenantId, 1);
		}
	});
});
