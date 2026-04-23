import { ImapFlow } from 'imapflow';
import ical from 'node-ical';
import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import { decrypt } from './crypto';

const DEFAULT_POLL_MS = 60000;

const pollers = new Map<number, { timer: NodeJS.Timeout, stopped: boolean }>();

const logger = console;

type IcsPartstat = 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION';

const normalizePartstat = (raw: string | undefined): IcsPartstat => {
	if (!raw) return 'NEEDS-ACTION';
	const upper = raw.toUpperCase();

	if (upper === 'ACCEPTED' || upper === 'DECLINED' || upper === 'TENTATIVE') return upper;

	return 'NEEDS-ACTION';
};

const processReplyIcs = async (app: Application, icsSource: string): Promise<boolean> => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let parsed: any;

	try {
		parsed = ical.sync.parseICS(icsSource);
	} catch (err) {
		logger.warn('[invites/replyPoller] failed to parse ICS body:', err);

		return false;
	}

	const method = (parsed.method || '').toUpperCase();

	if (method !== 'REPLY') return false;

	for (const key of Object.keys(parsed)) {
		const ev = parsed[key];

		if (!ev || ev.type !== 'VEVENT' || !ev.uid) continue;
		const uid = String(ev.uid);
		const attendeeEntry = ev.attendee;
		// node-ical yields attendee as object or array
		const attendees = Array.isArray(attendeeEntry) ? attendeeEntry : attendeeEntry ? [ attendeeEntry ] : [];

		for (const att of attendees) {
			const rawVal = typeof att === 'string' ? att : (att?.val ?? '');
			const email = String(rawVal)
				.replace(/^MAILTO:/i, '')
				.trim()
				.toLowerCase();

			if (!email) continue;
			const params = typeof att === 'string' ? {} : (att?.params ?? {});
			const partstat = normalizePartstat(params.PARTSTAT);

			// find meeting by uid, then attendee by email
			const meetingsRes = await app.service('meetings').find({
				paginate: false,
				query: { uid }
			});
			const list = Array.isArray(meetingsRes) ? meetingsRes : (meetingsRes as { data: unknown[] }).data;
			const meeting = (list as Array<{ id: number }>)[0];

			if (!meeting) continue;

			const attsRes = await app.service('meetingAttendees').find({
				paginate: false,
				query: { meetingId: meeting.id, email }
			});
			const aList = Array.isArray(attsRes) ? attsRes : (attsRes as { data: unknown[] }).data;
			const attendeeRow = (aList as MeetingAttendee[])[0];

			if (!attendeeRow?.id) continue;

			await app.service('meetingAttendees').patch(attendeeRow.id, { partstat }, { provider: undefined });
		}
	}

	return true;
};

const pollOnce = async (app: Application, tenantConfig: TenantInviteConfig): Promise<void> => {
	if (!tenantConfig.imapHost) return;
	const invites = app.get('invites');

	if (!invites?.encryptionKey) return;

	let client: ImapFlow | undefined;

	try {
		client = new ImapFlow({
			host: tenantConfig.imapHost,
			port: tenantConfig.imapPort ?? 993,
			secure: tenantConfig.imapSecure ?? true,
			auth: {
				user: tenantConfig.imapUser ?? '',
				pass: tenantConfig.imapPass ? decrypt(tenantConfig.imapPass, invites.encryptionKey) : ''
			},
			logger: false
		});

		await client.connect();
		const lock = await client.getMailboxLock('INBOX');

		try {
			for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true, uid: true })) {
				if (!msg.source) continue;
				const source = msg.source.toString('utf8');
				// only look at messages that contain a text/calendar part with method REPLY
				const icsMatch = source.match(/BEGIN:VCALENDAR[\s\S]+?END:VCALENDAR/);

				if (!icsMatch) continue;

				const ok = await processReplyIcs(app, icsMatch[0]);

				if (ok) {
					await client.messageFlagsAdd(msg.uid, [ '\\Seen' ], { uid: true });
				}
			}
		} finally {
			lock.release();
		}
	} catch (err) {
		logger.warn(`[invites/replyPoller] tenant ${tenantConfig.tenantId} poll failed:`, err);
	} finally {
		if (client) {
			try { await client.logout(); } catch { /* noop */ }
		}
	}
};

export const startPollerForTenant = (app: Application, tenantConfig: TenantInviteConfig): void => {
	stopPollerForTenant(tenantConfig.tenantId);
	if (!tenantConfig.imapHost || !tenantConfig.enabled) return;

	const intervalMs = app.get('invites')?.imapPollIntervalMs ?? DEFAULT_POLL_MS;
	const state = { timer: undefined as unknown as NodeJS.Timeout, stopped: false };

	const tick = async () => {
		if (state.stopped) return;
		await pollOnce(app, tenantConfig);
		if (!state.stopped) state.timer = setTimeout(tick, intervalMs);
	};

	state.timer = setTimeout(tick, 5000); // small delay on boot
	pollers.set(tenantConfig.tenantId, state);
};

export const stopPollerForTenant = (tenantId: number): void => {
	const existing = pollers.get(tenantId);

	if (existing) {
		existing.stopped = true;
		if (existing.timer) clearTimeout(existing.timer);
		pollers.delete(tenantId);
	}
};

export const stopAllPollers = (): void => {
	for (const tenantId of Array.from(pollers.keys())) {
		stopPollerForTenant(tenantId);
	}
};
