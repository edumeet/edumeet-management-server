import assert from 'assert';

import { scopeFindVisibility, scopeGetVisibility } from '../../src/services/meetings/meetings';
import type { HookContext } from '../../src/declarations';

interface Options {
	provider?: string;
	roles?: string[];
	tenantAdmin?: boolean;
	query?: Record<string, unknown>;
	id?: number;
}

const makeContext = (options: Options = {}) => {
	const provider = 'provider' in options ? options.provider : 'socketio';
	const { roles, tenantAdmin, query = {}, id } = options;

	const chain = () => {
		const q = {
			select: () => q,
			where: () => q,
			// eslint-disable-next-line no-unused-vars
			then: (resolve: (rows: unknown[]) => void) => resolve([])
		};

		return q;
	};
	const knex = () => chain();

	return {
		method: id === undefined ? 'find' : 'get',
		id,
		params: {
			provider,
			query,
			user: provider ? { id: 9, tenantId: 1, roles, tenantAdmin } : undefined
		},
		app: { get: (k: string) => (k === 'postgresqlClient' ? knex : undefined) }
	} as unknown as HookContext;
};

describe('meetings visibility scoping', () => {
	it('hides everything from an ordinary user who is involved in no meeting', async () => {
		const ctx = makeContext({ roles: [] });

		await scopeFindVisibility(ctx);

		assert.strictEqual(ctx.params.query?.id, -1);
	});

	it('leaves the query alone for the edumeet-server account the room servers log in with', async () => {
		const ctx = makeContext({ roles: [ 'edumeet-server' ], query: { roomId: 3, meetingToken: 'ABCDEFGHJKLM' } });

		await scopeFindVisibility(ctx);

		assert.deepStrictEqual(ctx.params.query, { roomId: 3, meetingToken: 'ABCDEFGHJKLM' });
	});

	it('leaves the query alone for a super admin', async () => {
		const ctx = makeContext({ roles: [ 'super-admin' ] });

		await scopeFindVisibility(ctx);

		assert.deepStrictEqual(ctx.params.query, {});
	});

	it('leaves the query alone for an internal call', async () => {
		const ctx = makeContext({ provider: undefined });

		await scopeFindVisibility(ctx);

		assert.deepStrictEqual(ctx.params.query, {});
	});

	it('still lets a tenant admin see the tenant', async () => {
		const ctx = makeContext({ roles: [], tenantAdmin: true });

		await scopeFindVisibility(ctx);

		assert.deepStrictEqual(ctx.params.query, {});
	});

	it('refuses a get to an ordinary user outside the meeting', async () => {
		await assert.rejects(scopeGetVisibility(makeContext({ roles: [], id: 5 })), /Meeting not found/);
	});

	it('allows a get to the edumeet-server account', async () => {
		await scopeGetVisibility(makeContext({ roles: [ 'edumeet-server' ], id: 5 }));
	});
});
