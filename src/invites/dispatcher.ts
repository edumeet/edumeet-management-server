import type { Application, HookContext } from '../declarations';
import type { Meeting } from '../services/meetings/meetings.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { sendInviteEmail } from './sender';
import { logger } from '../logger';

// How long to wait for additional events on the same meeting before dispatching.
// 2s absorbs the client's create-meeting + create-attendees burst into one dispatch.
export const DISPATCH_DEBOUNCE_MS = 2000;

const pendingDispatches = new Map<number, NodeJS.Timeout>();
const pendingSequenceBumps = new Set<number>();

const loadTenantConfig = async (app: Application, tenantId: number): Promise<TenantInviteConfig | undefined> => {
	const res = await app.service('tenantInviteConfigs').find({
		paginate: false,
		query: { tenantId }
	});
	const list = Array.isArray(res) ? res : (res as { data: unknown[] }).data;
	const cfg = (list as TenantInviteConfig[])[0];

	if (!cfg || !cfg.enabled) return undefined;

	return cfg;
};

const loadAttendees = async (app: Application, meetingId: number): Promise<MeetingAttendee[]> => {
	const res = await app.service('meetingAttendees').find({
		paginate: false,
		query: { meetingId }
	});
	const list = Array.isArray(res) ? res : (res as { data: unknown[] }).data;

	return list as MeetingAttendee[];
};

interface InviteRoom {
	name: string;
	meetingsOnly: boolean;
}

const loadRoom = async (app: Application, roomId: number): Promise<InviteRoom | undefined> => {
	try {
		const room = await app.service('rooms').get(roomId) as { name?: string, meetingsOnly?: unknown };

		if (!room.name) return undefined;

		return { name: room.name, meetingsOnly: Boolean(room.meetingsOnly) };
	} catch {
		return undefined;
	}
};

const loadOrganizerUserName = async (app: Application, organizerId: number | undefined): Promise<string | undefined> => {
	if (!organizerId) return undefined;
	try {
		const user = await app.service('users').get(organizerId);

		return (user as { name?: string, email?: string }).name || (user as { email?: string }).email;
	} catch {
		return undefined;
	}
};

const loadTenantName = async (app: Application, tenantId: number): Promise<string | undefined> => {
	try {
		const tenant = await app.service('tenants').get(tenantId);

		return (tenant as { name?: string }).name;
	} catch {
		return undefined;
	}
};

// A guest-list change needs ONE sequence bump per logical save, not one per attendee row,
// or a burst that straddles the debounce window re-notifies earlier attendees twice for the
// same save. Skipped entirely while nobody has been notified yet (all lastNotifiedSequence
// still -1), so a freshly created meeting's first REQUEST goes out at SEQUENCE:0.
const bumpSequenceForGuestListChange = async (app: Application, meetingId: number): Promise<void> => {
	try {
		const attendees = await loadAttendees(app, meetingId);

		if (!attendees.some((a) => (a.lastNotifiedSequence ?? -1) >= 0)) return;

		const knex = app.get('postgresqlClient');

		await knex('meetings')
			.where({ id: meetingId })
			.increment('sequence', 1);
	} catch (err) {
		logger.warn('[invites/dispatcher] sequence bump on guest-list change failed:', err);
	}
};

// Runs after the debounce window. Loads current state, filters by lastNotifiedSequence,
// and sends one REQUEST per attendee whose notified-sequence is behind the meeting's
// current sequence. Existing attendees skip when they're already up to date.
const runDispatch = async (app: Application, meetingId: number): Promise<void> => {
	try {
		const meeting = await app.service('meetings').get(meetingId);
		const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

		if (!tenantConfig) return;
		const room = await loadRoom(app, meeting.roomId);

		if (!room) return;
		const attendees = await loadAttendees(app, meetingId);
		const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
		const tenantName = await loadTenantName(app, meeting.tenantId);
		const method: 'REQUEST' | 'CANCEL' = meeting.status === 'CANCELLED' ? 'CANCEL' : 'REQUEST';
		const currentSequence = meeting.sequence ?? 0;

		// Dedup: only notify attendees whose lastNotifiedSequence is behind.
		// sender.sendInviteEmail bumps lastNotifiedSequence after a successful REQUEST.
		// The organizer IS included: creating a meeting in edumeet doesn't put the event
		// in the organizer's own calendar (Gmail/Outlook) — the iMIP email is the only
		// path there. Their attendee row is pre-set ACCEPTED, so it shows as accepted.
		const toNotify = attendees.filter((a) => (a.lastNotifiedSequence ?? -1) < currentSequence);

		await Promise.all(toNotify.map((a) => sendInviteEmail(app, {
			method,
			meeting,
			attendee: a,
			allAttendees: attendees,
			tenantConfig,
			roomName: room.name,
			meetingsOnly: room.meetingsOnly,
			organizerUserName,
			tenantName
		})));
	} catch (err) {
		logger.error('[invites/dispatcher] runDispatch failed:', err);
	}
};

// Schedules a dispatch for a meeting. If one is already scheduled, resets the timer
// so rapid bursts of events collapse into a single dispatch.
const scheduleDispatch = (app: Application, meetingId: number, bumpSequence = false): void => {
	if (bumpSequence) pendingSequenceBumps.add(meetingId);

	const existing = pendingDispatches.get(meetingId);

	if (existing) clearTimeout(existing);
	const timer = setTimeout(() => {
		pendingDispatches.delete(meetingId);

		const bump = pendingSequenceBumps.delete(meetingId);

		(async () => {
			if (bump) await bumpSequenceForGuestListChange(app, meetingId);
			await runDispatch(app, meetingId);
		})().catch((err) => {
			logger.error('[invites/dispatcher] scheduled dispatch failed:', err);
		});
	}, DISPATCH_DEBOUNCE_MS);

	pendingDispatches.set(meetingId, timer);
};

export const rescheduleRoomMeetings = async (app: Application, roomId: number | string): Promise<void> => {
	const knex = app.get('postgresqlClient');
	const rows: Array<{ id: number | string }> = await knex('meetings').where({ roomId })
		.select('id');

	for (const row of rows) scheduleDispatch(app, Number(row.id), true);
};

// before-hook on meetings.remove: capture attendees and send CANCEL before the DB row is gone.
// Runs synchronously (not debounced) because the cascade-delete is about to wipe attendees.
export const beforeMeetingRemoveDispatch = async (context: HookContext): Promise<void> => {
	if (!context.id) return;
	try {
		const meeting = await context.app.service('meetings').get(context.id);
		const tenantConfig = await loadTenantConfig(context.app, meeting.tenantId);

		if (!tenantConfig) return;
		const room = await loadRoom(context.app, meeting.roomId);

		if (!room) return;
		const attendees = await loadAttendees(context.app, meeting.id as number);
		const organizerUserName = await loadOrganizerUserName(context.app, meeting.organizerId);
		const tenantName = await loadTenantName(context.app, meeting.tenantId);
		const cancelled = { ...meeting, status: 'CANCELLED' as const };

		// Include the organizer in the cancellation too, so the event is removed from
		// their own calendar (it only got there via the REQUEST email in the first place).
		await Promise.all(
			attendees.map((a) => sendInviteEmail(context.app, {
				method: 'CANCEL',
				meeting: cancelled,
				attendee: a,
				allAttendees: attendees,
				tenantConfig,
				roomName: room.name,
				meetingsOnly: room.meetingsOnly,
				organizerUserName,
				tenantName
			}))
		);
	} catch (err) {
		logger.warn('[invites/dispatcher] beforeMeetingRemoveDispatch failed (continuing):', err);
	}
};

export const registerMeetingEventHandlers = (app: Application): void => {
	// Any event on a meeting or its attendees schedules a debounced dispatch for that meetingId.
	// runDispatch then picks up the current state and sends to attendees not yet notified at
	// the current sequence — collapsing bursts into one email per attendee per logical save.

	app.service('meetings').on('created', (meeting: Meeting) => {
		scheduleDispatch(app, Number(meeting.id));
	});

	app.service('meetings').on('patched', (meeting: Meeting) => {
		// meeting.sequence already bumped by the patch resolver
		scheduleDispatch(app, Number(meeting.id));
	});

	app.service('meetingAttendees').on('created', (attendee: MeetingAttendee) => {
		// Bumping is deferred to the debounced dispatch so a multi-attendee save advances
		// the sequence once. Direct knex there avoids the meetings.patched event loop.
		scheduleDispatch(app, Number(attendee.meetingId), true);
	});

	app.service('meetingAttendees').on('removed', async (attendee: MeetingAttendee) => {
		const meetingId = Number(attendee.meetingId);

		try {
			// CANCEL to the removed attendee goes out immediately — it's a direct action,
			// not part of a batched save, and the attendee row is already gone.
			const meeting = await app.service('meetings').get(meetingId);
			const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

			if (tenantConfig) {
				const room = await loadRoom(app, meeting.roomId);

				if (room) {
					const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
					const tenantName = await loadTenantName(app, meeting.tenantId);

					await sendInviteEmail(app, {
						method: 'CANCEL',
						meeting: { ...meeting, status: 'CANCELLED' as const },
						attendee,
						allAttendees: [ attendee ],
						tenantConfig,
						roomName: room.name,
						meetingsOnly: room.meetingsOnly,
						organizerUserName,
						tenantName
					});
				}
			}

			// Bump sequence + schedule dispatch so remaining attendees see the updated guest list.
			scheduleDispatch(app, meetingId, true);
		} catch (err) {
			// meeting may already be deleted (cascade) — ignore silently
			logger.debug('[invites/dispatcher] meetingAttendees.removed handler skipped:', err);
		}
	});
};
