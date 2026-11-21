import assert from 'assert';

import {
	meetingDataResolver,
	meetingDataValidator,
	meetingExternalResolver,
	meetingPatchValidator,
	meetingQueryValidator,
	meetingResolver
} from '../../src/services/meetings/meetings.schema';
import {
	roomDataResolver,
	roomDataSuperAdminResolver,
	roomPatchValidator
} from '../../src/services/rooms/rooms.schema';
import type { HookContext } from '../../src/declarations';

const context = (): HookContext => ({
	params: { user: { id: 7, tenantId: 1 } },
	data: { name: 'board' },
	app: { service: () => { throw new Error('no service expected'); } }
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as HookContext;

describe('meetings-only schemas', () => {
	it('gives every new meeting a token', async () => {
		const a = await meetingDataResolver.resolve({}, context()) as { meetingToken: string };
		const b = await meetingDataResolver.resolve({}, context()) as { meetingToken: string };

		assert.match(a.meetingToken, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
		assert.notStrictEqual(a.meetingToken, b.meetingToken);
	});

	it('refuses to change a token through patch, since sent invitations must keep working', async () => {
		await assert.rejects(meetingPatchValidator({ meetingToken: 'ABCDEFGHJKLM' }), /validation failed/);
	});

	it('still lets an ordinary patch through', async () => {
		await meetingPatchValidator({ title: 'renamed' });
	});

	it('lets the room server look a token up by room', async () => {
		await meetingQueryValidator({ roomId: 7, meetingToken: 'ABCDEFGHJKLM', $limit: 1 });
	});

	it('tells the room server whether the meeting is open, only for a lookup by token', async () => {
		const services = { get: async () => ({}), find: async () => [] };
		const lookup = (query: object) => ({ params: { query }, app: { service: () => services } }) as unknown as HookContext;
		const meeting = { id: 1, roomId: 7, startsAt: Date.now() + (3 * 3_600_000), endsAt: Date.now() + (4 * 3_600_000) };

		const byToken = await meetingResolver.resolve(meeting as never, lookup({ roomId: 7, meetingToken: 'ABCDEFGHJKLM' })) as { tokenWindow?: { state: string } };
		const listed = await meetingResolver.resolve(meeting as never, lookup({ roomId: 7 })) as { tokenWindow?: unknown };
		const byOperator = await meetingResolver.resolve(meeting as never, lookup({ roomId: 7, meetingToken: { $ne: 'X' } })) as { tokenWindow?: unknown };

		assert.strictEqual(byToken.tokenWindow?.state, 'early');
		assert.strictEqual(listed.tokenWindow, undefined);
		assert.strictEqual(byOperator.tokenWindow, undefined);
	});

	it('does not take a token window from a client', async () => {
		await assert.rejects(meetingPatchValidator({ tokenWindow: { state: 'open' } }), /validation failed/);
		await assert.rejects(meetingDataValidator({ title: 't', startsAt: Date.now(), endsAt: Date.now() + 1, timezone: 'UTC', locale: 'en', roomId: 7, tokenWindow: {} }), /validation failed/);
	});

	it('does not hand the last activity of the room to a client', async () => {
		const meeting = { id: 1, roomId: 7, startsAt: 1, endsAt: 2, lastActiveAt: 3 };
		const sent = await meetingExternalResolver.resolve(meeting as never, { params: { provider: 'rest' } } as unknown as HookContext) as { lastActiveAt?: unknown, roomId: number };

		assert.strictEqual(sent.lastActiveAt, undefined);
		assert.strictEqual(sent.roomId, 7);
	});

	it('does not take the last activity of the room from a client', async () => {
		await assert.rejects(meetingPatchValidator({ lastActiveAt: Date.now() }), /validation failed/);
		await assert.rejects(meetingDataValidator({ title: 't', startsAt: Date.now(), endsAt: Date.now() + 1, timezone: 'UTC', locale: 'en', roomId: 7, lastActiveAt: Date.now() }), /validation failed/);
	});

	it('lets a room owner toggle meetingsOnly', async () => {
		await roomPatchValidator({ meetingsOnly: true });
		await assert.rejects(roomPatchValidator({ meetingsOnly: 'yes' }), /validation failed/);
	});

	it('creates rooms with the mode off unless asked otherwise', async () => {
		const plain = await roomDataResolver.resolve({ name: 'board' }, context()) as { meetingsOnly: boolean };
		const on = await roomDataResolver.resolve({ name: 'board', meetingsOnly: true }, context()) as { meetingsOnly: boolean };
		const admin = await roomDataSuperAdminResolver.resolve({ name: 'board', tenantId: 1 }, context()) as { meetingsOnly: boolean };

		assert.strictEqual(plain.meetingsOnly, false);
		assert.strictEqual(on.meetingsOnly, true);
		assert.strictEqual(admin.meetingsOnly, false);
	});
});
