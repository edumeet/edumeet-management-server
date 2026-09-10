import assert from 'assert';

import { meetingDataResolver } from '../../src/services/meetings/meetings.schema';
import type { HookContext } from '../../src/declarations';

const context = (tenantId: number | undefined, fqdns: unknown): HookContext => ({
	params: { user: tenantId == null ? undefined : { id: 7, tenantId } },
	app: {
		service: (name: string) => {
			if (name === 'tenantFQDNs') {
				return {
					find: async () => {
						if (fqdns instanceof Error) throw fqdns;

						return fqdns;
					}
				};
			}
			throw new Error(`unexpected service ${name}`);
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as HookContext;

const uidFor = async (ctx: HookContext): Promise<string> => {
	const resolved = await meetingDataResolver.resolve({}, ctx);

	return (resolved as { uid: string }).uid;
};

describe('meeting UID', () => {
	it('uses the tenant FQDN as the domain part', async () => {
		const uid = await uidFor(context(1, [ { id: 3, fqdn: 'meet.example.edu' } ]));

		assert.ok(uid.endsWith('@meet.example.edu'), `unexpected uid ${uid}`);
	});

	it('never uses the mDNS-reserved .local pseudo-TLD', async () => {
		const uid = await uidFor(context(1, [ { id: 3, fqdn: 'meet.example.edu' } ]));

		assert.ok(!uid.includes('.local'), `uid must not sit under .local: ${uid}`);
	});

	it('takes the lowest-id FQDN when a tenant has several', async () => {
		// the service is asked for $sort id asc with $limit 1, so the first row is the pick
		const uid = await uidFor(context(1, [
			{ id: 2, fqdn: 'first.example.edu' },
			{ id: 9, fqdn: 'second.example.edu' }
		]));

		assert.ok(uid.endsWith('@first.example.edu'), `unexpected uid ${uid}`);
	});

	it('falls back to a bare UUID when the tenant has no FQDN', async () => {
		const uid = await uidFor(context(1, []));

		assert.ok(!uid.includes('@'), `expected no domain part, got ${uid}`);
		assert.match(uid, /^[0-9a-f-]{36}$/);
	});

	it('falls back to a bare UUID when the FQDN lookup fails', async () => {
		const uid = await uidFor(context(1, new Error('service down')));

		assert.match(uid, /^[0-9a-f-]{36}$/);
	});

	it('falls back to a bare UUID with no tenant on the request', async () => {
		const uid = await uidFor(context(undefined, []));

		assert.match(uid, /^[0-9a-f-]{36}$/);
	});

	it('is unique per meeting', async () => {
		const ctx = context(1, [ { id: 1, fqdn: 'meet.example.edu' } ]);

		assert.notStrictEqual(await uidFor(ctx), await uidFor(ctx));
	});

	it('asks for a deterministic single row', async () => {
		let seen: Record<string, unknown> = {};
		const ctx = {
			params: { user: { id: 7, tenantId: 4 } },
			app: {
				service: () => ({
					find: async (params: { query: Record<string, unknown> }) => {
						seen = params.query;

						return [ { id: 1, fqdn: 'meet.example.edu' } ];
					}
				})
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any as HookContext;

		await uidFor(ctx);

		assert.strictEqual(seen.tenantId, 4);
		assert.strictEqual(seen.$limit, 1);
		assert.deepStrictEqual(seen.$sort, { id: 1 });
	});
});
