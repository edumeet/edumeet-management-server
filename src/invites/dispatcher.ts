import type { Application, HookContext } from '../declarations';
import type { Meeting } from '../services/meetings/meetings.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { sendInviteEmail } from './sender';

const logger = console;

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

const dispatchForMeeting = async (
	app: Application,
	meeting: Meeting,
	method: 'REQUEST' | 'CANCEL',
	onlyAttendees?: MeetingAttendee[]
): Promise<void> => {
	try {
		const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

		if (!tenantConfig) return;
		const roomName = await loadRoomName(app, meeting.roomId);

		if (!roomName) return;
		const attendees = onlyAttendees ?? await loadAttendees(app, meeting.id as number);
		const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
		const tenantName = await loadTenantName(app, meeting.tenantId);

		await Promise.all(attendees.map((a) => sendInviteEmail(app, {
			method,
			meeting,
			attendee: a,
			tenantConfig,
			roomName,
			organizerUserName,
			tenantName
		})));
	} catch (err) {
		logger.error('[invites/dispatcher] dispatchForMeeting failed:', err);
	}
};

// before-hook on meetings.remove: capture attendees and send CANCEL before the DB row is gone
export const beforeMeetingRemoveDispatch = async (context: HookContext): Promise<void> => {
	if (!context.id) return;
	try {
		const meeting = await context.app.service('meetings').get(context.id);
		const attendees = await loadAttendees(context.app, meeting.id as number);
		// stash for after-hook if needed; for now do the send here synchronously
		const cancelled = { ...meeting, status: 'CANCELLED' as const };

		await dispatchForMeeting(context.app, cancelled, 'CANCEL', attendees);
	} catch (err) {
		logger.warn('[invites/dispatcher] beforeMeetingRemoveDispatch failed (continuing):', err);
	}
};

export const registerMeetingEventHandlers = (app: Application): void => {
	// meetings.created → REQUEST to all attendees (attendees may be added right after; we also listen to meetingAttendees.created)
	app.service('meetings').on('created', (meeting: Meeting) => {
		dispatchForMeeting(app, meeting, 'REQUEST');
	});

	// meetings.patched → REQUEST to all attendees with bumped sequence
	app.service('meetings').on('patched', (meeting: Meeting) => {
		if (meeting.status === 'CANCELLED') {
			dispatchForMeeting(app, meeting, 'CANCEL');
		} else {
			dispatchForMeeting(app, meeting, 'REQUEST');
		}
	});

	// meetingAttendees.created → REQUEST just this attendee
	app.service('meetingAttendees').on('created', async (attendee: MeetingAttendee) => {
		try {
			const meeting = await app.service('meetings').get(attendee.meetingId);
			const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

			if (!tenantConfig) return;
			const roomName = await loadRoomName(app, meeting.roomId);

			if (!roomName) return;
			const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
			const tenantName = await loadTenantName(app, meeting.tenantId);

			await sendInviteEmail(app, {
				method: 'REQUEST',
				meeting,
				attendee,
				tenantConfig,
				roomName,
				organizerUserName,
				tenantName
			});
		} catch (err) {
			logger.error('[invites/dispatcher] meetingAttendees.created handler failed:', err);
		}
	});

	// meetingAttendees.removed → CANCEL just this attendee (their calendar drops the event)
	app.service('meetingAttendees').on('removed', async (attendee: MeetingAttendee) => {
		try {
			const meeting = await app.service('meetings').get(attendee.meetingId);
			const tenantConfig = await loadTenantConfig(app, meeting.tenantId);

			if (!tenantConfig) return;
			const roomName = await loadRoomName(app, meeting.roomId);

			if (!roomName) return;
			const organizerUserName = await loadOrganizerUserName(app, meeting.organizerId);
			const tenantName = await loadTenantName(app, meeting.tenantId);

			await sendInviteEmail(app, {
				method: 'CANCEL',
				meeting: { ...meeting, status: 'CANCELLED' as const },
				attendee,
				tenantConfig,
				roomName,
				organizerUserName,
				tenantName
			});
		} catch (err) {
			// meeting may already be deleted (cascade) — ignore silently
			logger.debug?.('[invites/dispatcher] meetingAttendees.removed handler skipped:', err);
		}
	});
};
