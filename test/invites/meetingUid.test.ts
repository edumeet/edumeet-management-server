import assert from 'assert';

import { meetingDataResolver } from '../../src/services/meetings/meetings.schema';
import type { HookContext } from '../../src/declarations';

// The UID doubles as a filename: CalDAV clients name the resource after it, and any character
// outside this set gets rewritten or encoded on the way, so the name no longer equals the UID
// inside the file. That mismatch is what Google CalDAV refused with HTTP 400 for every UID we
// ever sent with an "@", while UIDs made only of these characters were accepted. The rule is
// therefore general, not one client's: a UID must survive resource naming unchanged.
const RESOURCE_NAME_SAFE = /^[a-zA-Z0-9_\-.]+$/;

const context = (tenantId: number | undefined, fqdnService?: { find: () => Promise<unknown> }): HookContext => ({
	params: { user: tenantId == null ? undefined : { id: 7, tenantId } },
	app: {
		service: (name: string) => {
			if (name === 'tenantFQDNs' && fqdnService) return fqdnService;
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
	it('is a bare UUID', async () => {
		assert.match(await uidFor(context(1)), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	it('uses only characters that survive being made into a resource name', async () => {
		const uid = await uidFor(context(1));

		assert.match(uid, RESOURCE_NAME_SAFE, 'a resource named after this UID must still equal it');
		assert.ok(!uid.includes('@'), uid);
	});

	it('never uses the mDNS-reserved .local pseudo-TLD', async () => {
		assert.ok(!(await uidFor(context(1))).includes('.local'));
	});

	it('does not consult the tenant FQDN list at all', async () => {
		let calls = 0;
		const spying = {
			find: async () => {
				calls++;

				return [ { id: 1, fqdn: 'meet.example.edu' } ];
			}
		};

		const uid = await uidFor(context(1, spying));

		assert.strictEqual(calls, 0, 'a domain suffix must not be reintroduced from tenant data');
		assert.ok(!uid.includes('meet.example.edu'));
	});

	it('works with no tenant on the request', async () => {
		assert.match(await uidFor(context(undefined)), /^[0-9a-f-]{36}$/);
	});

	it('is unique per meeting', async () => {
		const ctx = context(1);

		assert.notStrictEqual(await uidFor(ctx), await uidFor(ctx));
	});
});
