import { HookContext } from '../declarations';

type MeetingPath = 'meetings' | 'meetingAttendees' | 'meetingOccurrenceRsvps';

type Getter = { get: (id: number, params: unknown) => Promise<Record<string, unknown>> };

const internalGet = (context: HookContext, path: MeetingPath, id: unknown) =>
	(context.app.service(path) as unknown as Getter).get(Number(id), {
		...context.params,
		provider: undefined,
		query: {}
	});

const roomOfMeeting = async (context: HookContext, meetingId: unknown): Promise<string> =>
	String((await internalGet(context, 'meetings', meetingId)).roomId);

const roomOfAttendee = async (context: HookContext, attendeeId: unknown): Promise<string> =>
	roomOfMeeting(context, (await internalGet(context, 'meetingAttendees', attendeeId)).meetingId);

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
	const roomOfParent = { meetings: async (_context: HookContext, roomId: unknown) => String(roomId), meetingAttendees: roomOfMeeting, meetingOccurrenceRsvps: roomOfAttendee }[path];
	const rows: Array<Record<string, unknown>> = Array.isArray(context.data) ? context.data : context.data ? [ context.data ] : [];
	const rooms: string[] = [];

	if (context.id !== undefined && context.id !== null) {
		if (path === 'meetings') rooms.push(await roomOfMeeting(context, context.id));
		else if (path === 'meetingAttendees') rooms.push(await roomOfAttendee(context, context.id));
		else rooms.push(await roomOfAttendee(context, (await internalGet(context, path, context.id)).meetingAttendeeId));
	}

	const named = rows.map((row) => row[parentKey]).filter((value) => value !== undefined && value !== null);

	for (const value of named) rooms.push(await roomOfParent(context, value));

	if (rooms.length === 0) {
		for (const value of queryIds(context.params?.query?.[parentKey])) rooms.push(await roomOfParent(context, value));
	}

	return [ ...new Set(rooms) ];
};

const assertRoomAccess = async (context: HookContext, roomId: string): Promise<void> => {
	const { user } = context.params;

	if (user?.tenantAdmin || user?.tenantOwner) {
		const { tenantId } = await context.app.service('rooms').get(roomId);

		if (tenantId && tenantId != parseInt(String(context.params.user.tenantId)))
			throw new Error('You are not an owner of this room');

		return;
	}

	const { total } = await context.app.service('roomOwners').find({
		query: {
			roomId: parseInt(roomId),
			userId: context.params.user.id
		}
	});

	if (total === 0)
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

	for (const roomId of roomIds) await assertRoomAccess(context, roomId);
};

export const isRoomOwnerOrAdminForMeetingAttendee = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const roomIds = await resolveRoomIds(context, 'meetingAttendees');

	if (roomIds.length === 0)
		throw new Error('meetingId required');

	for (const roomId of roomIds) await assertRoomAccess(context, roomId);
};

export const isRoomOwnerOrAdminForMeetingOccurrenceRsvp = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const roomIds = await resolveRoomIds(context, 'meetingOccurrenceRsvps');

	if (roomIds.length === 0)
		throw new Error('meetingAttendeeId required');

	for (const roomId of roomIds) await assertRoomAccess(context, roomId);
};
