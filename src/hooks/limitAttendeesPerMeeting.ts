import { BadRequest } from '@feathersjs/errors';
import type { HookContext } from '../declarations';

export const DEFAULT_MAX_ATTENDEES_PER_MEETING = 300;

// Every change of a meeting sends an invite to each guest, each carrying the whole guest list,
// so the list is bounded (invites.maxAttendeesPerMeeting).
export const limitAttendeesPerMeeting = async (context: HookContext): Promise<HookContext> => {
	const data = context.data as { meetingId?: number } | Array<{ meetingId?: number }>;
	const rows = Array.isArray(data) ? data : [ data ];
	const max = context.app.get('invites')?.maxAttendeesPerMeeting ?? DEFAULT_MAX_ATTENDEES_PER_MEETING;
	const adding = new Map<number, number>();

	for (const row of rows) {
		const meetingId = Number(row?.meetingId);

		if (meetingId) adding.set(meetingId, (adding.get(meetingId) ?? 0) + 1);
	}

	const knex = context.app.get('postgresqlClient');

	for (const [ meetingId, count ] of adding) {
		const [ { total } ] = await knex('meetingAttendees')
			.where({ meetingId })
			.count({ total: '*' });

		if (Number(total) + count > max)
			throw new BadRequest(`A meeting can have at most ${max} attendees`);
	}

	return context;
};
