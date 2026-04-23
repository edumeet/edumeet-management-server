import { ImapFlow } from 'imapflow';
import ical from 'node-ical';
import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { MeetingOccurrenceRsvp } from '../services/meetingOccurrenceRsvps/meetingOccurrenceRsvps.schema';
import { decrypt } from './crypto';
import { logger } from '../logger';

const DEFAULT_POLL_MS = 60000;

const pollers = new Map<number, { timer: NodeJS.Timeout, stopped: boolean }>();

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

	// node-ical stores calendar-level properties (PRODID, VERSION, METHOD) under
	// `parsed.vcalendar`, not at the top level. Fall back to raw-source regex too,
	// because different node-ical versions vary.
	const vcalMethod = parsed?.vcalendar?.method || parsed?.vcalendar?.METHOD;
	const topMethod = parsed?.method || parsed?.METHOD;
	const rawMatch = icsSource.match(/^METHOD:([A-Z-]+)/mi);
	const method = String(vcalMethod || topMethod || rawMatch?.[1] || '').toUpperCase();

	logger.debug(`[invites/replyPoller] parsed ICS, METHOD=${method}`);
	if (method !== 'REPLY') {
		logger.debug(`[invites/replyPoller] ICS preview: ${icsSource.substring(0, 400).replace(/\r?\n/g, ' | ')}`);
		logger.debug(`[invites/replyPoller] parsed top-level keys: ${Object.keys(parsed).join(', ')}`);

		return false;
	}

	let matched = 0;

	for (const key of Object.keys(parsed)) {
		const ev = parsed[key];

		if (!ev || ev.type !== 'VEVENT' || !ev.uid) continue;
		const uid = String(ev.uid);
		const attendeeEntry = ev.attendee;
		// node-ical yields attendee as object or array
		const attendees = Array.isArray(attendeeEntry) ? attendeeEntry : attendeeEntry ? [ attendeeEntry ] : [];

		// RFC 5546 §2.1.5: higher SEQUENCE wins; DTSTAMP is the tiebreaker for equal SEQUENCE.
		// This guards against out-of-order delivery (MTA queuing, retries) where e.g. an
		// ACCEPT email arrives after the user's corrective DECLINE sent 10s later.
		const evDtstampMs = ev.dtstamp ? new Date(ev.dtstamp).getTime() : 0;
		const evSequence = Number(ev.sequence ?? 0) || 0;
		// RECURRENCE-ID (epoch ms) = per-occurrence exception to a recurring series.
		// Absent = series-level response.
		const recurrenceId = ev.recurrenceid ? new Date(ev.recurrenceid).getTime() : null;

		logger.debug(`[invites/replyPoller] VEVENT uid=${uid} attendees=${attendees.length} seq=${evSequence} dtstamp=${evDtstampMs} recurrenceId=${recurrenceId ?? 'none'}`);

		for (const att of attendees) {
			const rawVal = typeof att === 'string' ? att : (att?.val ?? '');
			const email = String(rawVal)
				.replace(/^MAILTO:/i, '')
				.trim()
				.toLowerCase();

			if (!email) {
				logger.warn('[invites/replyPoller] attendee has empty email, skipping:', att);
				continue;
			}
			const params = typeof att === 'string' ? {} : (att?.params ?? {});
			const partstat = normalizePartstat(params.PARTSTAT);

			logger.debug(`[invites/replyPoller] attendee email=${email} partstat=${partstat}`);

			// find meeting by uid, then attendee by email
			const meetingsRes = await app.service('meetings').find({
				paginate: false,
				query: { uid }
			});
			const list = Array.isArray(meetingsRes) ? meetingsRes : (meetingsRes as { data: unknown[] }).data;
			const meeting = (list as Array<{ id: number }>)[0];

			if (!meeting) {
				logger.warn(`[invites/replyPoller] no meeting found for uid=${uid}`);
				continue;
			}

			const attsRes = await app.service('meetingAttendees').find({
				paginate: false,
				query: { meetingId: meeting.id, email }
			});
			const aList = Array.isArray(attsRes) ? attsRes : (attsRes as { data: unknown[] }).data;
			const attendeeRow = (aList as MeetingAttendee[])[0];

			if (!attendeeRow?.id) {
				logger.warn(`[invites/replyPoller] no attendee row for meetingId=${meeting.id} email=${email}`);
				continue;
			}

			// Per-occurrence exception: write to meetingOccurrenceRsvps; leave series partstat alone.
			if (recurrenceId != null) {
				// Coerce — Postgres bigint columns deserialize as strings and the schema validator rejects non-numbers.
				const attendeeIdNum = Number(attendeeRow.id);
				const rsvpRes = await app.service('meetingOccurrenceRsvps').find({
					paginate: false,
					query: { meetingAttendeeId: attendeeIdNum, recurrenceId }
				});
				const rList = Array.isArray(rsvpRes) ? rsvpRes : (rsvpRes as { data: unknown[] }).data;
				const rsvpRow = (rList as MeetingOccurrenceRsvp[])[0];

				if (rsvpRow?.id) {
					const rSeq = rsvpRow.replySequence != null ? Number(rsvpRow.replySequence) : null;
					const rStamp = rsvpRow.replyDtstamp != null ? Number(rsvpRow.replyDtstamp) : null;

					if (rSeq != null && rStamp != null &&
						(evSequence < rSeq || (evSequence === rSeq && evDtstampMs <= rStamp))) {
						logger.info(`[invites/replyPoller] stale occurrence REPLY for attendee id=${attendeeIdNum} recurrenceId=${recurrenceId}, skipping`);
						continue;
					}

					await app.service('meetingOccurrenceRsvps').patch(
						Number(rsvpRow.id),
						{ partstat, replyDtstamp: evDtstampMs, replySequence: evSequence },
						{ provider: undefined }
					);
				} else {
					await app.service('meetingOccurrenceRsvps').create(
						{
							meetingAttendeeId: attendeeIdNum,
							recurrenceId,
							partstat,
							replyDtstamp: evDtstampMs,
							replySequence: evSequence
						},
						{ provider: undefined }
					);
				}
				matched++;
				logger.info(`[invites/replyPoller] occurrence RSVP attendee id=${attendeeIdNum} recurrenceId=${recurrenceId} -> ${partstat} (seq=${evSequence})`);
				continue;
			}

			// Series-level: skip if the stored reply is newer per (SEQUENCE, DTSTAMP) — prevents an
			// out-of-order ACCEPT from overwriting a later DECLINE the user sent seconds later.
			// Coerce because bigint columns deserialize as strings in node-postgres.
			const storedSeq = attendeeRow.replySequence != null ? Number(attendeeRow.replySequence) : null;
			const storedDtstamp = attendeeRow.replyDtstamp != null ? Number(attendeeRow.replyDtstamp) : null;

			if (storedSeq != null && storedDtstamp != null) {
				if (evSequence < storedSeq || (evSequence === storedSeq && evDtstampMs <= storedDtstamp)) {
					logger.info(`[invites/replyPoller] stale REPLY for attendee id=${attendeeRow.id} (incoming seq=${evSequence} dtstamp=${evDtstampMs} <= stored seq=${storedSeq} dtstamp=${storedDtstamp}), skipping`);
					continue;
				}
			}

			await app.service('meetingAttendees').patch(
				attendeeRow.id,
				{ partstat, replyDtstamp: evDtstampMs, replySequence: evSequence },
				{ provider: undefined }
			);
			matched++;
			logger.info(`[invites/replyPoller] updated partstat for attendee id=${attendeeRow.id} to ${partstat} (seq=${evSequence})`);
		}
	}

	logger.info(`[invites/replyPoller] processed REPLY, ${matched} attendee(s) updated`);

	return true;
};

const pollOnce = async (app: Application, tenantConfig: TenantInviteConfig): Promise<void> => {
	if (!tenantConfig.imapHost) return;
	const invites = app.get('invites');

	if (!invites?.encryptionKey) return;

	// Guard against misconfigured IMAP: empty user or password would always fail auth.
	// Log a clear message once per cycle instead of spamming imap errors.
	if (!tenantConfig.imapUser || !tenantConfig.imapPass) {
		logger.warn(`[invites/replyPoller] tenant ${tenantConfig.tenantId} IMAP credentials incomplete (user or password empty) — poll skipped`);

		return;
	}

	logger.info(`[invites/replyPoller] tenant ${tenantConfig.tenantId} polling ${tenantConfig.imapHost}:${tenantConfig.imapPort ?? 993} as ${tenantConfig.imapUser}`);

	let client: ImapFlow | undefined;

	try {
		client = new ImapFlow({
			host: tenantConfig.imapHost,
			port: tenantConfig.imapPort ?? 993,
			secure: tenantConfig.imapSecure ?? true,
			auth: {
				user: tenantConfig.imapUser,
				pass: decrypt(tenantConfig.imapPass, invites.encryptionKey)
			},
			logger: false
		});

		// ImapFlow emits 'error' asynchronously for socket issues (e.g. ETIMEOUT)
		// that can arrive AFTER our try/catch completes. Without a listener,
		// Node treats it as unhandled and crashes the whole process.
		client.on('error', (err) => {
			logger.warn(`[invites/replyPoller] tenant ${tenantConfig.tenantId} IMAP async error (ignored): ${(err as Error)?.message ?? err}`);
		});

		await client.connect();
		logger.info(`[invites/replyPoller] tenant ${tenantConfig.tenantId} connected to IMAP`);
		const lock = await client.getMailboxLock('INBOX');

		try {
			let unseenCount = 0;
			let icsFoundCount = 0;
			const uidsToMarkSeen: number[] = [];

			for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true, uid: true })) {
				unseenCount++;
				if (!msg.source) continue;
				const source = msg.source.toString('utf8');
				// The ICS may be base64-encoded inside an attachment part; decode any base64
				// chunks in the source before searching, in addition to the inline text.
				const sources: string[] = [ source ];

				for (const b64Match of source.matchAll(/Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([A-Za-z0-9+/=\s]+?)(?=\r?\n--|\r?\n\r?\nContent-|$)/gi)) {
					try {
						const decoded = Buffer.from(b64Match[1].replace(/\s/g, ''), 'base64').toString('utf8');

						if (decoded.includes('BEGIN:VCALENDAR')) sources.push(decoded);
					} catch { /* noop */ }
				}

				let icsMatch: RegExpMatchArray | null = null;

				for (const s of sources) {
					icsMatch = s.match(/BEGIN:VCALENDAR[\s\S]+?END:VCALENDAR/);
					if (icsMatch) break;
				}

				if (!icsMatch) {
					logger.debug(`[invites/replyPoller] msg uid=${msg.uid} has no VCALENDAR block`);
					continue;
				}

				icsFoundCount++;
				const ok = await processReplyIcs(app, icsMatch[0]);

				if (ok) {
					uidsToMarkSeen.push(msg.uid);
				}
			}

			// Mark all successfully processed messages as Seen in one STORE command AFTER
			// the FETCH iterator is fully drained. Running STORE inside the FETCH loop
			// causes some IMAP servers to stop responding until the socket times out.
			if (uidsToMarkSeen.length > 0) {
				try {
					await client.messageFlagsAdd(uidsToMarkSeen, [ '\\Seen' ], { uid: true });
				} catch (err) {
					logger.warn('[invites/replyPoller] batch flag update failed (messages will reprocess next cycle):', err);
				}
			}

			if (unseenCount > 0) {
				logger.info(`[invites/replyPoller] tenant ${tenantConfig.tenantId} polled ${unseenCount} unseen message(s), ${icsFoundCount} had ICS`);
			}

			// Retention cleanup: purge SEEN messages older than the retention window so the
			// dedicated invite mailbox doesn't grow unbounded. Only touches messages we've
			// already flagged as processed — unprocessed mail (welcome emails, junk) is left alone.
			const retentionDays = Number(invites?.imapRetentionDays ?? 30);

			if (retentionDays > 0) {
				try {
					const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
					const oldUids = await client.search({ before: cutoff, seen: true }, { uid: true });

					if (oldUids && oldUids.length > 0) {
						await client.messageDelete(oldUids, { uid: true });
						logger.info(`[invites/replyPoller] tenant ${tenantConfig.tenantId} purged ${oldUids.length} message(s) older than ${retentionDays}d`);
					}
				} catch (err) {
					logger.warn('[invites/replyPoller] retention cleanup failed (non-fatal):', err);
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
			logger.info(`[invites/replyPoller] tenant ${tenantConfig.tenantId} poll cycle complete`);
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
