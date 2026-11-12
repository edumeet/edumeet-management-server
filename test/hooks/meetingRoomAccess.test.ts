import assert from 'assert';

import {
	isRoomOwnerOrAdminForMeeting,
	isRoomOwnerOrAdminForMeetingAttendee,
	isRoomOwnerOrAdminForMeetingOccurrenceRsvp,
	MAX_IDS
} from '../../src/hooks/isRoomOwnerOrAdminForMeeting';
import type { HookContext } from '../../src/declarations';

// The caller (user 9) owns room 1, not room 2. Meeting 10, attendee 100 and RSVP 1000
// are in room 1; meeting 20, attendee 200 and RSVP 2000 are in room 2. Meeting 30 with
// attendee 300 belongs to another tenant, in room 3, which has no tenant.
const rows: Record<string, Record<number, Record<string, unknown>>> = {
	meetings: { 10: { roomId: 1, tenantId: 1 }, 20: { roomId: 2, tenantId: 1 }, 30: { roomId: 3, tenantId: 2 } },
	meetingAttendees: { 100: { meetingId: 10 }, 200: { meetingId: 20 }, 300: { meetingId: 30 } },
	meetingOccurrenceRsvps: { 1000: { meetingAttendeeId: 100 }, 2000: { meetingAttendeeId: 200 } },
	rooms: { 1: { tenantId: 1 }, 2: { tenantId: 1 }, 3: { tenantId: null }, 4: { tenantId: 2 } },
	roomOwners: { 1: { roomId: 1, userId: 9 }, 2: { roomId: 3, userId: 9 } }
};

// every lookup by a list of ids the hook made, to count them
const lookups: Array<{ table: string, ids: number[] }> = [];

type Row = Record<string, unknown>;

// knex(table).select(...).where({...}).whereIn(column, ids), awaited
/* eslint-disable no-unused-vars */
const knex = (table: string) => {
	const filters: Array<(row: Row) => boolean> = [];
	const builder = {
		select: () => builder,
		where: (condition: Row) => {
			filters.push((row) => Object.entries(condition).every(([ key, value ]) => row[key] === value));

			return builder;
		},
		whereIn: (column: string, ids: number[]) => {
			lookups.push({ table, ids });
			filters.push((row) => ids.includes(Number(row[column])));

			return builder;
		},
		then: (resolve: (found: Row[]) => unknown, reject: (error: unknown) => unknown) =>
			Promise.resolve(Object.entries(rows[table] ?? {}).map(([ id, row ]) => ({ id: Number(id), ...row }))
				.filter((row) => filters.every((filter) => filter(row)))).then(resolve, reject)
	};

	return builder;
};
/* eslint-enable no-unused-vars */

const makeContext = (
	method: string,
	options: { id?: number, data?: Record<string, unknown>, query?: Record<string, unknown>, user?: Record<string, unknown> } = {}
) => ({
	method,
	id: options.id,
	data: options.data,
	params: { provider: 'rest', query: options.query ?? {}, user: { id: 9, tenantId: 1, roles: [], ...options.user } },
	app: { get: () => knex }
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

		it('looks one id up once, however often the query repeats it', async () => {
			lookups.length = 0;
			await isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: Array(MAX_IDS).fill(100) } } }));
			assert.deepStrictEqual(lookups, [ { table: 'meetingAttendees', ids: [ 100 ] }, { table: 'meetings', ids: [ 10 ] }, { table: 'roomOwners', ids: [ 1 ] } ]);
		});

		it('reads the parents of many ids in one query per table', async () => {
			lookups.length = 0;
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [ 100, 200, 100, 200 ] } } })),
				/not an owner/
			);
			assert.deepStrictEqual(lookups, [ { table: 'meetingAttendees', ids: [ 100, 200 ] }, { table: 'meetings', ids: [ 10, 20 ] }, { table: 'roomOwners', ids: [ 1, 2 ] } ]);
		});

		it('refuses a longer list than MAX_IDS before any lookup', async () => {
			lookups.length = 0;
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: Array(MAX_IDS + 1).fill(100) } } })),
				/At most/
			);
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingAttendee(makeContext('find', { query: { meetingId: { $in: Array(MAX_IDS + 1).fill(10) } } })),
				/At most/
			);
			assert.strictEqual(lookups.length, 0);
		});

		it('refuses an id that names no row', async () => {
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [ 100, 999 ] } } })),
				/No record found/
			);
			await assert.rejects(isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('get', { id: 999 })), /No record found/);
		});

		it('refuses an id that is no positive integer', async () => {
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [ 100, '100 OR 1=1' ] } } })),
				/positive integer/
			);
		});

		it('does not find a meeting of another tenant, whoever owns its room', async () => {
			// user 9 has an owner row for room 3, and a tenant admin passes a room without a tenant
			await assert.rejects(isRoomOwnerOrAdminForMeetingAttendee(makeContext('find', { query: { meetingId: 30 } })), /No record found/);
			await assert.rejects(isRoomOwnerOrAdminForMeetingAttendee(makeContext('patch', { id: 300, data: { name: 'x' } })), /No record found/);
			await assert.rejects(
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: 300 }, user: { tenantAdmin: true } })),
				/No record found/
			);
		});

		it('lets a tenant admin into the rooms of the own tenant only, in one query', async () => {
			const admin = { id: 5, tenantAdmin: true };

			lookups.length = 0;
			await isRoomOwnerOrAdminForMeeting(makeContext('create', { data: { roomId: 2 }, user: admin }));
			assert.deepStrictEqual(lookups, [ { table: 'rooms', ids: [ 2 ] } ]);
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('create', { data: { roomId: 4 }, user: admin })), /not an owner/);
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('create', { data: { roomId: 99 }, user: admin })), /No record found/);
			// room 3 has no tenant
			await assert.rejects(isRoomOwnerOrAdminForMeeting(makeContext('create', { data: { roomId: 3 }, user: admin })), /not an owner/);
			await assert.rejects(
				isRoomOwnerOrAdminForMeeting(makeContext('find', { query: { roomId: { $in: [ 1, 2, 4 ] } }, user: admin })),
				/not an owner/
			);
		});

		it('refuses an RSVP query that names no attendee', async () => {
			await assert.rejects(isRoomOwnerOrAdminForMeetingOccurrenceRsvp(makeContext('find', { query: { meetingAttendeeId: { $in: [] } } })), /required/);
		});
	});
});
