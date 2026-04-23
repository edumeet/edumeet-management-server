import type { Application, HookContext } from '../declarations';
import type { Meeting } from '../services/meetings/meetings.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { sendInviteEmail } from './sender';

const logger = console;

// How long to wait for additional events on the same meeting before dispatching.
// 2s absorbs the client's create-meeting + create-attendees burst into one dispatch.
const DISPATCH_DEBOUNCE_MS = 2000;

const pendingDispatches = new Map<number, NodeJS.Timeout>();

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

const loadRoomName = async (app: Application, roomId: number): Promise<string | undefined> => {
	try {
		const room = await app.service('rooms').get(roomId);

		return (room as { name?: string }).name;
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

// Runs after the debounce window. Loads current state, filters by lastNotifiedSequence,
// and sends one REQUEST per attendee whose notified-sequence is behind the meeting's
// current sequence. Existing attendees skip when they're already up to date.
const runDispatch = async (app: Application, meetingId: number): Promise<void> => {
	try {
		const meeting = await app.service('meetings').get(meetingId);
		const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

		if (!tenantConfig) return;
		const roomName = await loadRoomName(app, meeting.roomId);

		if (!roomName) return;
		const attendees = await loadAttendees(app, meetingId);
		const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
		const tenantName = await loadTenantName(app, meeting.tenantId);
		const method: 'REQUEST' | 'CANCEL' = meeting.status === 'CANCELLED' ? 'CANCEL' : 'REQUEST';
		const currentSequence = meeting.sequence ?? 0;

		// Dedup: only notify attendees whose lastNotifiedSequence is behind.
		// sender.sendInviteEmail bumps lastNotifiedSequence after a successful REQUEST.
		const toNotify = attendees.filter((a) => (a.lastNotifiedSequence ?? -1) < currentSequence);

		await Promise.all(toNotify.map((a) => sendInviteEmail(app, {
			method,
			meeting,
			attendee: a,
			allAttendees: attendees,
			tenantConfig,
			roomName,
			organizerUserName,
			tenantName
		})));
	} catch (err) {
		logger.error('[invites/dispatcher] runDispatch failed:', err);
	}
};

// Schedules a dispatch for a meeting. If one is already scheduled, resets the timer
// so rapid bursts of events collapse into a single dispatch.
const scheduleDispatch = (app: Application, meetingId: number): void => {
	const existing = pendingDispatches.get(meetingId);

	if (existing) clearTimeout(existing);
	const timer = setTimeout(() => {
		pendingDispatches.delete(meetingId);
		runDispatch(app, meetingId).catch((err) => {
			logger.error('[invites/dispatcher] scheduled dispatch failed:', err);
		});
	}, DISPATCH_DEBOUNCE_MS);

	pendingDispatches.set(meetingId, timer);
};

// before-hook on meetings.remove: capture attendees and send CANCEL before the DB row is gone.
// Runs synchronously (not debounced) because the cascade-delete is about to wipe attendees.
export const beforeMeetingRemoveDispatch = async (context: HookContext): Promise<void> => {
	if (!context.id) return;
	try {
		const meeting = await context.app.service('meetings').get(context.id);
		const tenantConfig = await loadTenantConfig(context.app, meeting.tenantId);

		if (!tenantConfig) return;
		const roomName = await loadRoomName(context.app, meeting.roomId);

		if (!roomName) return;
		const attendees = await loadAttendees(context.app, meeting.id as number);
		const organizerUserName = await loadOrganizerUserName(context.app, meeting.organizerId);
		const tenantName = await loadTenantName(context.app, meeting.tenantId);
		const cancelled = { ...meeting, status: 'CANCELLED' as const };

		await Promise.all(attendees.map((a) => sendInviteEmail(context.app, {
			method: 'CANCEL',
			meeting: cancelled,
			attendee: a,
			allAttendees: attendees,
			tenantConfig,
			roomName,
			organizerUserName,
			tenantName
		})));
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

	app.service('meetingAttendees').on('created', async (attendee: MeetingAttendee) => {
		const meetingId = Number(attendee.meetingId);

		try {
			// Bump meeting.sequence so existing attendees qualify for re-dispatch with
			// updated guest list (industry-standard iTIP). Direct knex avoids triggering
			// the meetings.patched event loop.
			const knex = app.get('postgresqlClient');

			await knex('meetings')
				.where({ id: meetingId })
				.increment('sequence', 1);
		} catch (err) {
			logger.warn('[invites/dispatcher] sequence bump on attendee add failed:', err);
		}
		scheduleDispatch(app, meetingId);
	});

	app.service('meetingAttendees').on('removed', async (attendee: MeetingAttendee) => {
		const meetingId = Number(attendee.meetingId);

		try {
			// CANCEL to the removed attendee goes out immediately — it's a direct action,
			// not part of a batched save, and the attendee row is already gone.
			const meeting = await app.service('meetings').get(meetingId);
			const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

			if (tenantConfig) {
				const roomName = await loadRoomName(app, meeting.roomId);

				if (roomName) {
					const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
					const tenantName = await loadTenantName(app, meeting.tenantId);

					await sendInviteEmail(app, {
						method: 'CANCEL',
						meeting: { ...meeting, status: 'CANCELLED' as const },
						attendee,
						allAttendees: [ attendee ],
						tenantConfig,
						roomName,
						organizerUserName,
						tenantName
					});
				}
			}

			// Bump sequence + schedule dispatch so remaining attendees see the updated guest list.
			const knex = app.get('postgresqlClient');

			await knex('meetings')
				.where({ id: meetingId })
				.increment('sequence', 1);
			scheduleDispatch(app, meetingId);
		} catch (err) {
			// meeting may already be deleted (cascade) — ignore silently
			logger.debug?.('[invites/dispatcher] meetingAttendees.removed handler skipped:', err);
		}
	});
};
