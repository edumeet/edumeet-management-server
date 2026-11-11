import assert from 'assert';

import {
	isRoomOwnerOrAdminForMeeting,
	isRoomOwnerOrAdminForMeetingAttendee,
	isRoomOwnerOrAdminForMeetingOccurrenceRsvp
} from '../../src/hooks/isRoomOwnerOrAdminForMeeting';
import type { HookContext } from '../../src/declarations';

// The caller (user 9) owns room 1, not room 2. Meeting 10, attendee 100 and RSVP 1000
// are in room 1; meeting 20, attendee 200 and RSVP 2000 are in room 2.
const rows: Record<string, Record<number, Record<string, unknown>>> = {
	meetings: { 10: { roomId: 1 }, 20: { roomId: 2 } },
	meetingAttendees: { 100: { meetingId: 10 }, 200: { meetingId: 20 } },
	meetingOccurrenceRsvps: { 1000: { meetingAttendeeId: 100 }, 2000: { meetingAttendeeId: 200 } },
	rooms: { 1: { tenantId: 1 }, 2: { tenantId: 1 } }
};

const makeContext = (method: string, options: { id?: number, data?: Record<string, unknown>, query?: Record<string, unknown> } = {}) => ({
	method,
	id: options.id,
	data: options.data,
	params: { provider: 'rest', query: options.query ?? {}, user: { id: 9, tenantId: 1, roles: [] } },
	app: {
		service: (name: string) => ({
			get: async (id: number) => {
				const row = rows[name]?.[Number(id)];

				if (!row) throw new Error(`no ${name} ${id}`);

				return row;
			},
			find: async ({ query }: { query: { roomId: number, userId: number } }) =>
				({ total: query.roomId === 1 && query.userId === 9 ? 1 : 0 })
		})
	}
}) as unknown as HookContext;

describe('meeting room access', () => {
	describe('meetings', () => {
		it('refuses moving another room\'s meeting into an own room', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('patch', { id: 20, data: { roomId: 1 } })), /not an owner/);
		});

		it('refuses moving an own meeting into another room', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('patch', { id: 10, data: { roomId: 2 } })), /not an owner/);
		});

		it('refuses removing another room\'s meeting, whatever roomId the query names', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('remove', { id: 20, query: { roomId: 1 } })), /not an owner/);
		});

		it('allows patching an own meeting', async () => {
			await isRoomOwnerOrAdminForMeeting(makeContext('patch', { id: 10, data: { title: 'x' } }));
			await isRoomOwnerOrAdminForMeeting(makeContext('patch', { id: 10, data: { roomId: 1 } }));
		});

		it('checks the room of a new meeting', async () => {
			await isRoomOwnerOrAdminForMeeting(makeContext('create', { data: { roomId: 1 } }));
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('create', { data: { roomId: 2 } })), /not an owner/);
		});

		it('still allows a find without a room', async () => {
			await isRoomOwnerOrAdminForMeeting(makeContext('find'));
		});
	});

	describe('meetingAttendees', () => {
		it('refuses moving another room\'s attendee into an own meeting', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeetingAttendee(makeContext('patch', { id: 200, data: { meetingId: 10 } })), /not an owner/);
		});

		it('allows an own attendee', async () => {
			await isRoomOwnerOrAdminForMeetingAttendee(makeContext('patch', { id: 100, data: { meetingId: 10 } }));
			await isRoomOwnerOrAdminForMeetingAttendee(makeContext('find', { query: { meetingId: 10 } }));
		});
	});

	describe('meetingOccurrenceRsvps', () => {
		it('checks every attendee of an $in query, not only the first', async () => {
			await isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [ 100 ] } } }));
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [ 100, 200 ] } } })),
				/not an owner/
			);
		});

		it('refuses moving another room\'s RSVP to an own attendee', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('patch', { id: 2000, data: { meetingAttendeeId: 100 } })), /not an owner/);
		});

		it('refuses an RSVP query that names no attendee', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [] } } })), /required/);
		});
	});
});
