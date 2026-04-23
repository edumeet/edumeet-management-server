import { HookContext } from '../declarations';

const resolveRoomId = async (context: HookContext, path: 'meetings' | 'meetingAttendees'): Promise<string | undefined> => {
	if (context.data?.roomId) return String(context.data.roomId);

	if (path === 'meetings') {
		if (context.id) {
			const meeting = await context.app.service('meetings').get(context.id, {
				...context.params,
				provider: undefined,
				query: {}
			});

			return String(meeting.roomId);
		}
		if (context.params?.query?.roomId)
			return String(context.params.query.roomId);

		return undefined;
	}

	// path === 'meetingAttendees'
	let meetingId: number | undefined;

	if (context.data?.meetingId) meetingId = Number(context.data.meetingId);
	else if (context.params?.query?.meetingId) meetingId = Number(context.params.query.meetingId);
	else if (context.id) {
		const attendee = await context.app.service('meetingAttendees').get(context.id, {
			...context.params,
			provider: undefined,
			query: {}
		});

		meetingId = attendee.meetingId;
	}

	if (!meetingId) return undefined;

	const meeting = await context.app.service('meetings').get(meetingId, {
		...context.params,
		provider: undefined,
		query: {}
	});

	return String(meeting.roomId);
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

	const roomId = await resolveRoomId(context, 'meetings');

	if (!roomId) {
		// find-all with no roomId is allowed; the query resolver scopes to tenant
		if (context.method === 'find') return;
		throw new Error('No room id provided');
	}

	await assertRoomAccess(context, roomId);
};

export const isRoomOwnerOrAdminForMeetingAttendee = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;

	const roomId = await resolveRoomId(context, 'meetingAttendees');

	if (!roomId)
		throw new Error('meetingId required');

	await assertRoomAccess(context, roomId);
};
