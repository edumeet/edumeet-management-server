import { HookContext } from '../declarations';
import { rescheduleRoomMeetings } from '../invites/dispatcher';
import { logger } from '../logger';

export const rememberMeetingsOnly = async (context: HookContext): Promise<void> => {
	if (context.id == null || context.data?.meetingsOnly === undefined) return;

	const knex = context.app.get('postgresqlClient');
	const row = await knex('rooms').where({ id: context.id })
		.first('meetingsOnly');

	if (row) context.params.meetingsOnlyBefore = Boolean(row.meetingsOnly);
};

export const resendInvitesOnMeetingsOnlyChange = async (context: HookContext): Promise<void> => {
	const before = context.params.meetingsOnlyBefore;

	if (before === undefined || context.id == null) return;

	const after = Boolean((context.result as { meetingsOnly?: unknown } | undefined)?.meetingsOnly);

	if (after === before) return;

	try {
		await rescheduleRoomMeetings(context.app, context.id);
	} catch (err) {
		logger.warn(`[rooms] meetingsOnly changed on room ${context.id} but re-sending its invites failed:`, err);
	}
};
