import { BadRequest } from '@feathersjs/errors';
import type { Knex } from 'knex';
import type { HookContext } from '../declarations';

export const DEFAULT_MAX_ATTENDEES_PER_MEETING = 300;

// Every change of a meeting sends an invite to each guest, each carrying the whole guest list,
// so the list is bounded (invites.maxAttendeesPerMeeting). Runs in the create's transaction
// (transaction.start() before it): the client creates a new meeting's guests all at once, and
// counting outside one would let every one of them through.
export const limitAttendeesPerMeeting = async (context: HookContext): Promise<HookContext> => {
	const data = context.data as { meetingId?: number } | Array<{ meetingId?: number }>;
	const rows = Array.isArray(data) ? data : [ data ];
	const max = context.app.get('invites')?.maxAttendeesPerMeeting ?? DEFAULT_MAX_ATTENDEES_PER_MEETING;
	const adding = new Map<number, number>();

	for (const row of rows) {
		const meetingId = Number(row?.meetingId);

		if (meetingId) adding.set(meetingId, (adding.get(meetingId) ?? 0) + 1);
	}

	const db: Knex = (context.params as { transaction?: { trx?: Knex } } | undefined)?.transaction?.trx ?? context.app.get('postgresqlClient');

	for (const [ meetingId, count ] of adding) {
		// Held until the create commits: the next create for this meeting counts after it.
		await db('meetings').where({ id: meetingId })
			.forUpdate()
			.first('id');

		const [ { total } ] = await db('meetingAttendees')
			.where({ meetingId })
			.count({ total: '*' });

		if (Number(total) + count > max)
			throw new BadRequest(`A meeting can have at most ${max} attendees`);
	}

	return context;
};
