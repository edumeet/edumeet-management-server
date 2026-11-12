import { BadRequest, NotFound } from '@feathersjs/errors';
import { HookContext } from '../declarations';
import { strictId } from './strictId';

type MeetingPath = 'meetings' | 'meetingAttendees' | 'meetingOccurrenceRsvps';

// The most ids one request may name. The UI asks for the exceptions of all attendees of a
// meeting at once, so this must stay above the longest attendee list. The check costs the
// same few queries whatever the number.
export const MAX_IDS = 5000;

/**
 * The distinct ids of a list a request sent. The length is checked first: a request must
 * not be able to make the check itself expensive, by many ids or by one id many times.
 */
const distinctIds = (values: unknown[], name: string): number[] => {
	if (values.length > MAX_IDS) throw new BadRequest(`At most ${MAX_IDS} ${name} values`);

	return [ ...new Set(values.map((value) => strictId(value, name))) ];
};

/**
 * One column of the rows with the given ids, read in one query. The services' get would
 * also load each room with its owners and roles and each meeting's attendees, which a
 * check of the room does not need.
 */
const parentsOf = async (context: HookContext, table: MeetingPath, column: string, ids: number[]): Promise<unknown[]> => {
	if (ids.length === 0) return [];

	const query = context.app.get('postgresqlClient')(table).select('id', column)
		.whereIn('id', ids);
	const tenantId = context.params.user?.tenantId;

	// As the meetings service does for every call of a user: a meeting of another tenant is
	// not there, whatever the room check would say.
	if (table === 'meetings' && tenantId != null) query.where({ tenantId: parseInt(String(tenantId)) });

	const found: Array<Record<string, unknown>> = await query;

	// ids are distinct, so a shorter answer means one of them names no row. The message does
	// not say at which level: that would tell which attendees exist in other tenants.
	if (found.length !== ids.length) throw new NotFound('No record found');

	return found.map((row) => row[column]);
};

const roomsOfMeetings = async (context: HookContext, meetingIds: unknown[]): Promise<string[]> =>
	(await parentsOf(context, 'meetings', 'roomId', distinctIds(meetingIds, 'meetingId'))).map(String);

const roomsOfAttendees = async (context: HookContext, attendeeIds: unknown[]): Promise<string[]> =>
	roomsOfMeetings(context, await parentsOf(context, 'meetingAttendees', 'meetingId', distinctIds(attendeeIds, 'meetingAttendeeId')));

const roomsOfRsvps = async (context: HookContext, rsvpIds: unknown[]): Promise<string[]> =>
	roomsOfAttendees(context, await parentsOf(context, 'meetingOccurrenceRsvps', 'meetingAttendeeId', distinctIds(rsvpIds, 'id')));

const roomsNamed = async (_context: HookContext, roomIds: unknown[]): Promise<string[]> =>
	distinctIds(roomIds, 'roomId').map(String);

// The ids of a query value: a plain id, or every id of {$in: [...]} (the UI fetches
// exceptions for all attendees at once). Anything else names no id.
const queryIds = (value: unknown): unknown[] => {
	if (typeof value === 'number' || typeof value === 'string') return [ value ];
	if (value && typeof value === 'object' && Array.isArray((value as { $in?: unknown[] }).$in))
		return (value as { $in: unknown[] }).$in;

	return [];
};

/**
 * Every room the request touches. For a call with an id that is the room of the stored
 * object, whatever the body says; a body that moves the object adds the room it moves to.
 * Without an id, the rooms named in the body, else in the query. All of them must pass.
 */
const resolveRoomIds = async (context: HookContext, path: MeetingPath): Promise<string[]> => {
	// A patch or remove without an id would reach rows by the query, which this does not
	// check when the body names a parent. The services allow no such calls today.
	if ((context.method === 'patch' || context.method === 'remove') && (context.id === undefined || context.id === null))
		throw new Error('Only one row at a time');

	const parentKey = { meetings: 'roomId', meetingAttendees: 'meetingId', meetingOccurrenceRsvps: 'meetingAttendeeId' }[path];
	const roomsOfSelf = { meetings: roomsOfMeetings, meetingAttendees: roomsOfAttendees, meetingOccurrenceRsvps: roomsOfRsvps }[path];
	const roomsOfParents = { meetings: roomsNamed, meetingAttendees: roomsOfMeetings, meetingOccurrenceRsvps: roomsOfAttendees }[path];
	const rows: Array<Record<string, unknown>> = Array.isArray(context.data) ? context.data : context.data ? [ context.data ] : [];
	const rooms: string[] = [];

	if (rows.length > MAX_IDS) throw new BadRequest(`At most ${MAX_IDS} rows`);

	if (context.id !== undefined && context.id !== null) rooms.push(...await roomsOfSelf(context, [ context.id ]));

	const named = rows.map((row) => row[parentKey]).filter((value) => value !== undefined && value !== null);

	rooms.push(...await roomsOfParents(context, named));

	if (rooms.length === 0) rooms.push(...await roomsOfParents(context, queryIds(context.params?.query?.[parentKey])));

	return [ ...new Set(rooms) ];
};

// All rooms in one query, like the lookups above: a request can name many.
const assertRoomAccess = async (context: HookContext, roomIds: string[]): Promise<void> => {
	const { user } = context.params;
	const ids = roomIds.map((roomId) => strictId(roomId, 'roomId'));
	const knex = context.app.get('postgresqlClient');

	if (user?.tenantAdmin || user?.tenantOwner) {
		const rooms: Array<{ tenantId: unknown }> = await knex('rooms').select('id', 'tenantId')
			.whereIn('id', ids);

		if (rooms.length !== ids.length) throw new NotFound('No record found');

		// A room without a tenant is no tenant's: it used to pass for the admins of all.
		if (rooms.some(({ tenantId }) => String(tenantId ?? '') !== String(user.tenantId ?? '')))
			throw new Error('You are not an owner of this room');

		return;
	}

	const owned: Array<{ roomId: unknown }> = await knex('roomOwners').select('roomId')
		.where({ userId: user.id })
		.whereIn('roomId', ids);
	const ownedIds = new Set(owned.map(({ roomId }) => String(roomId)));

	if (ids.some((id) => !ownedIds.has(String(id))))
		throw new Error('You are not an owner of this room');
};

export const isRoomOwnerOrAdminForMeeting = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const roomIds = await resolveRoomIds(context, 'meetings');

	if (roomIds.length === 0) {
		// find-all with no roomId is allowed; the query resolver scopes to tenant
		if (context.method === 'find') return;
		throw new Error('No room id provided');
	}

	await assertRoomAccess(context, roomIds);
};

export const isRoomOwnerOrAdminForMeetingAttendee = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const roomIds = await resolveRoomIds(context, 'meetingAttendees');

	if (roomIds.length === 0)
		throw new Error('meetingId required');

	await assertRoomAccess(context, roomIds);
};

export const isRoomOwnerOrAdminForMeetingOccurrenceRsvp = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const roomIds = await resolveRoomIds(context, 'meetingOccurrenceRsvps');

	if (roomIds.length === 0)
		throw new Error('meetingAttendeeId required');

	await assertRoomAccess(context, roomIds);
};
