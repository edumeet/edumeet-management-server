import assert from 'assert';

import {
	meetingDataResolver,
	meetingPatchValidator,
	meetingQueryValidator
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
