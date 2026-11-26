import { BadRequest } from '@feathersjs/errors';
import type { Knex } from 'knex';
import type { HookContext } from '../declarations';
import { whereMaybeUpcoming } from '../invites/dispatcher';

export const DEFAULT_MAX_MEETINGS_PER_ROOM = 100;

interface MeetingPlace {
	roomId?: unknown;
	rrule?: unknown;
	endsAt?: unknown;
}

const maybeUpcoming = (meeting: MeetingPlace, now: number): boolean =>
	(meeting.rrule !== undefined && meeting.rrule !== null) || Number(meeting.endsAt) > now;

// A change of a room's meetingsOnly re-sends the invites of every meeting of the room that may
// still take place, expanding each recurrence, so those meetings are bounded
// (invites.maxMeetingsPerRoom). A past single meeting does not count, so a room keeps its history.
// A patch counts too: it can move a meeting to another room or make a past one recurring.
// Runs in the create's or patch's transaction (transaction.start() before it), with the room
// locked, so requests that arrive together count one after the other.
export const limitMeetingsPerRoom = async (context: HookContext): Promise<HookContext> => {
	const data = (context.data ?? {}) as MeetingPlace;
	const db: Knex = (context.params as { transaction?: { trx?: Knex } } | undefined)?.transaction?.trx ?? context.app.get('postgresqlClient');
	const now = Date.now();
	let meeting: MeetingPlace = data;

	if (context.method === 'patch') {
		// A locking read: MySQL takes a transaction's snapshot at its first plain read, and the
		// count below must see what the requests before this one have written.
		const current = await db('meetings').where({ id: context.id })
			.forUpdate()
			.first('roomId', 'rrule', 'endsAt');

		if (!current) return context;

		meeting = {
			roomId: data.roomId ?? current.roomId,
			rrule: data.rrule !== undefined ? data.rrule : current.rrule,
			endsAt: data.endsAt ?? current.endsAt
		};

		if (Number(meeting.roomId) === Number(current.roomId) && maybeUpcoming(current, now)) return context;
	}

	const roomId = Number(meeting.roomId);

	if (!roomId || !maybeUpcoming(meeting, now)) return context;

	// Held until the create or patch commits: the next one for this room counts after it.
	await db('rooms').where({ id: roomId })
		.forUpdate()
		.first('id');

	const max = context.app.get('invites')?.maxMeetingsPerRoom ?? DEFAULT_MAX_MEETINGS_PER_ROOM;
	const [ { total } ] = await db('meetings').where({ roomId })
		.andWhere((qb: Knex.QueryBuilder) => whereMaybeUpcoming(qb, now))
		.count({ total: '*' });

	if (Number(total) >= max) {
		throw new BadRequest(`A room can have at most ${max} recurring or upcoming meetings. A recurring meeting counts until it is deleted, also after its series has ended.`);
	}

	return context;
};
