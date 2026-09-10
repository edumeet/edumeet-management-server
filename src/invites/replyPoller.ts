import { ImapFlow } from 'imapflow';
import ical from 'node-ical';
import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { MeetingOccurrenceRsvp } from '../services/meetingOccurrenceRsvps/meetingOccurrenceRsvps.schema';
import { decrypt } from './crypto';
import { logger } from '../logger';

const DEFAULT_POLL_MS = 60000;
// How long a REPLY that no meeting here owns is left unread before we consume it anyway.
// Independent deployments can share one invite mailbox, so an unrecognised reply usually
// belongs to a sibling that has not polled yet; a week is long enough to cover one being
// down, after which nobody is coming for it and retention should be allowed to purge it.
const UNCLAIMED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Small settle before the first cycle so boot is not competing with migrations.

export const POLLER_BOOT_DELAY_MS = 5000;

// Pollers are keyed by MAILBOX identity (host:port:user), NOT by tenant. Multiple tenants
// commonly share one invite mailbox (e.g. invitation@edumeet.eu); running one poller per
// tenant means N pollers race on the same inbox — whichever fetches first marks a reply
// \Seen, so the others never see it and replies for some tenants get silently consumed.
// One poller per unique mailbox fixes that; reply→meeting resolution is global-by-uid, so a
// single poller correctly updates partstat for every tenant sharing the mailbox.
//
// Separate DEPLOYMENTS (e.g. prod and dev) may also share one mailbox. They have separate
// databases, so a reply belongs to whichever one holds that meeting uid. See the mark-seen
// decision in pollOnce: a deployment consumes only the replies it recognises.
const pollers = new Map<string, { timer: NodeJS.Timeout, stopped: boolean }>();

const mailboxKey = (cfg: TenantInviteConfig): string =>
	`${cfg.imapHost}:${cfg.imapPort ?? 993}:${cfg.imapUser}`;

const mailboxLabel = (cfg: TenantInviteConfig): string =>
	`${cfg.imapUser}@${cfg.imapHost}`;

type IcsPartstat = 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION';

const normalizePartstat = (raw: string | undefined): IcsPartstat => {
	if (!raw) return 'NEEDS-ACTION';
	const upper = raw.toUpperCase();

	if (upper === 'ACCEPTED' || upper === 'DECLINED' || upper === 'TENTATIVE') return upper;

	return 'NEEDS-ACTION';
};

// Calendar parts arrive encoded. base64 is obvious, but quoted-printable is the trap: the
// raw source still contains a readable-looking BEGIN:VCALENDAR, so matching it directly
// yields an ICS where every "=" is "=3D" and long lines carry soft breaks. PARTSTAT=3DACCEPTED
// then normalizes to NEEDS-ACTION, silently losing the RSVP. Clients reach for
// quoted-printable whenever the ICS is not 7-bit clean, which a non-ASCII CN is enough to
// cause, so decoded candidates are tried before the raw source.
const decodeQuotedPrintable = (input: string): string => {
	const unfolded = input.replace(/[=]\r?\n/g, '');
	const bytes: number[] = [];

	for (let i = 0; i < unfolded.length; i++) {
		const hex = unfolded.substr(i + 1, 2);

		if (unfolded[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
			bytes.push(parseInt(hex, 16));
			i += 2;
		} else {
			for (const b of Buffer.from(unfolded[i], 'utf8')) bytes.push(b);
		}
	}

	return Buffer.from(bytes).toString('utf8');
};

const BASE64_PART = /Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([A-Za-z0-9+/=\s]+?)(?=\r?\n--|\r?\n\r?\nContent-|$)/gi;
const QP_PART = /Content-Transfer-Encoding:\s*quoted-printable[\s\S]*?\r?\n\r?\n([\s\S]+?)(?=\r?\n--|$)/gi;
const VCALENDAR = /BEGIN:VCALENDAR[\s\S]+?END:VCALENDAR/;

export const extractIcs = (source: string): string | null => {
	const candidates: string[] = [];

	for (const part of source.matchAll(BASE64_PART)) {
		try {
			candidates.push(Buffer.from(part[1].replace(/\s/g, ''), 'base64').toString('utf8'));
		} catch { /* noop */ }
	}

	for (const part of source.matchAll(QP_PART)) {
		try {
			candidates.push(decodeQuotedPrintable(part[1]));
		} catch { /* noop */ }
	}

	candidates.push(source);

	// A reply can carry more than one calendar: its REPLY part plus, in some clients, the
	// original REQUEST attached as invite.ics. Decoded attachments are tried first, so the
	// first hit is not necessarily the REPLY. Prefer a block that is one; otherwise fall back
	// to the first, which processReplyIcs will then correctly refuse as not a reply.
	const blocks: string[] = [];

	for (const candidate of candidates) {
		for (const match of candidate.matchAll(new RegExp(VCALENDAR.source, 'g'))) blocks.push(match[0]);
	}

	return blocks.find((b) => /^METHOD:REPLY\s*$/mi.test(b)) ?? blocks[0] ?? null;
};

export interface ReplyOutcome {
	isReply: boolean;
	// attendee rows this deployment recognised, whether or not anything was written. A
	// duplicate reply updates nothing but is still ours, and must be consumed or it is
	// reprocessed every cycle forever.
	claimed: number;
	updated: number;
}

export const processReplyIcs = async (app: Application, icsSource: string): Promise<ReplyOutcome> => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let parsed: any;

	try {
		parsed = ical.sync.parseICS(icsSource);
	} catch (err) {
		logger.warn('[invites/replyPoller] failed to parse ICS body:', err);

		return { isReply: false, claimed: 0, updated: 0 };
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

		return { isReply: false, claimed: 0, updated: 0 };
	}

	let claimed = 0;
	let updated = 0;

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
		// NaN from an unparseable date would pass the != null checks below and reach the DB,
		// where the insert throws and, before per-message isolation, stalled the whole mailbox.
		const asEpoch = (value: unknown): number | null => {
			if (!value) return null;
			const ms = new Date(value as string).getTime();

			return Number.isFinite(ms) ? ms : null;
		};
		const evDtstampMs = asEpoch(ev.dtstamp) ?? 0;
		const evSequence = Number(ev.sequence ?? 0) || 0;
		// RECURRENCE-ID (epoch ms) = per-occurrence exception to a recurring series.
		// Absent, or unparseable, = series-level response.
		const recurrenceId = asEpoch(ev.recurrenceid);

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

			claimed++;

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
				updated++;
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
			updated++;
			logger.info(`[invites/replyPoller] updated partstat for attendee id=${attendeeRow.id} to ${partstat} (seq=${evSequence})`);
		}
	}

	logger.info(`[invites/replyPoller] processed REPLY, ${claimed} attendee(s) recognised, ${updated} updated`);

	return { isReply: true, claimed, updated };
};

export const pollOnce = async (app: Application, tenantConfig: TenantInviteConfig): Promise<void> => {
	if (!tenantConfig.imapHost) return;
	const invites = app.get('invites');

	if (!invites?.encryptionKey) return;
	const mb = mailboxLabel(tenantConfig);

	// Guard against misconfigured IMAP: empty user or password would always fail auth.
	// Log a clear message once per cycle instead of spamming imap errors.
	if (!tenantConfig.imapUser || !tenantConfig.imapPass) {
		logger.warn(`[invites/replyPoller] mailbox ${mb} IMAP credentials incomplete (user or password empty) — poll skipped`);

		return;
	}

	logger.info(`[invites/replyPoller] mailbox ${mb} polling ${tenantConfig.imapHost}:${tenantConfig.imapPort ?? 993}`);

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
			logger: false,
			// Bound every phase so a hung TCP / firewall blackhole can't freeze the poller.
			// 30s is well under the 60s default poll interval — if a cycle exceeds it, the
			// socket raises and the outer try/catch recovers for the next cycle.
			socketTimeout: 30000
		});

		// ImapFlow emits 'error' asynchronously for socket issues (e.g. ETIMEOUT)
		// that can arrive AFTER our try/catch completes. Without a listener,
		// Node treats it as unhandled and crashes the whole process.
		client.on('error', (err) => {
			logger.warn(`[invites/replyPoller] mailbox ${mb} IMAP async error (ignored): ${(err as Error)?.message ?? err}`);
		});

		await client.connect();
		logger.info(`[invites/replyPoller] mailbox ${mb} connected to IMAP`);
		const lock = await client.getMailboxLock('INBOX');

		try {
			let unseenCount = 0;
			let icsFoundCount = 0;
			let unclaimedCount = 0;
			const uidsToMarkSeen: number[] = [];

			for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true, uid: true })) {
				unseenCount++;
				if (!msg.source) continue;

				const ics = extractIcs(msg.source.toString('utf8'));

				if (!ics) {
					logger.debug(`[invites/replyPoller] msg uid=${msg.uid} has no VCALENDAR block`);
					continue;
				}

				icsFoundCount++;

				// One bad message must not take the batch down with it. Before this, a throw here
				// escaped the fetch loop and uidsToMarkSeen was discarded, so every message in the
				// batch was re-fetched next cycle and a permanently unprocessable one stalled the
				// mailbox for good. Unmarked on failure, so a transient error still retries.
				try {
					const outcome = await processReplyIcs(app, ics);

					if (!outcome.isReply) continue;

					// Marking a message \Seen hides it from every other client of this mailbox, so
					// only consume replies this deployment actually recognised. An unrecognised one
					// most likely belongs to a sibling deployment sharing the mailbox that has not
					// polled yet; consuming it would silently lose that RSVP for good.
					if (outcome.claimed > 0) {
						uidsToMarkSeen.push(msg.uid);
						continue;
					}

					const sentMs = msg.envelope?.date ? new Date(msg.envelope.date).getTime() : NaN;

					if (Number.isFinite(sentMs) && Date.now() - sentMs > UNCLAIMED_TTL_MS) {
						logger.warn(`[invites/replyPoller] msg uid=${msg.uid} is a REPLY no meeting here owns and is older than the unclaimed window; marking seen`);
						uidsToMarkSeen.push(msg.uid);
					} else {
						unclaimedCount++;
					}
				} catch (err) {
					logger.error(`[invites/replyPoller] msg uid=${msg.uid} failed to process, left unread:`, err);
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
				logger.info(`[invites/replyPoller] mailbox ${mb} polled ${unseenCount} unseen message(s), ${icsFoundCount} had ICS`);
			}

			if (unclaimedCount > 0) {
				logger.info(`[invites/replyPoller] mailbox ${mb} left ${unclaimedCount} reply(ies) unread for another deployment sharing this mailbox`);
			}

			// Retention cleanup: purge SEEN messages older than the retention window so the
			// dedicated invite mailbox doesn't grow unbounded. Only touches messages we've
			// already flagged as processed — unprocessed mail (welcome emails, junk) is left alone.
			//   retentionDays === 0 → delete on the next cycle of the following day (IMAP
			//                            SEARCH BEFORE compares dates, not instants)
			//   retentionDays > 0   → delete messages older than N days
			//   retentionDays < 0   → cleanup fully disabled (e.g. -1)
			//   omitted / non-numeric → default 30
			const retentionRaw = invites?.imapRetentionDays;
			const retentionDays = typeof retentionRaw === 'number' ? retentionRaw : 30;

			if (retentionDays >= 0) {
				try {
					const cutoff = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
					const oldUids = await client.search({ before: cutoff, seen: true }, { uid: true });

					if (oldUids && oldUids.length > 0) {
						await client.messageDelete(oldUids, { uid: true });
						logger.info(`[invites/replyPoller] mailbox ${mb} purged ${oldUids.length} message(s) (retention=${retentionDays}d)`);
					}
				} catch (err) {
					logger.warn('[invites/replyPoller] retention cleanup failed (non-fatal):', err);
				}
			}
		} finally {
			lock.release();
		}
	} catch (err) {
		logger.warn(`[invites/replyPoller] mailbox ${mb} poll failed:`, err);
	} finally {
		if (client) {
			try { await client.logout(); } catch { /* noop */ }
			logger.info(`[invites/replyPoller] mailbox ${mb} poll cycle complete`);
		}
	}
};

const startPoller = (app: Application, key: string, cfg: TenantInviteConfig): void => {
	const invites = app.get('invites');
	const intervalMs = invites?.imapPollIntervalMs ?? DEFAULT_POLL_MS;
	const bootDelayMs = invites?.imapPollBootDelayMs ?? POLLER_BOOT_DELAY_MS;
	const state = { timer: undefined as unknown as NodeJS.Timeout, stopped: false };

	// Rescheduling lives in the finally: a rejection escaping here would otherwise both
	// surface as an unhandled rejection and end the poller for good, so RSVP processing would
	// stop until the next restart with nothing but a missing log line to show for it.
	const tick = async () => {
		if (state.stopped) return;
		try {
			await pollOnce(app, cfg);
		} catch (err) {
			logger.error(`[invites/replyPoller] mailbox ${mailboxLabel(cfg)} poll cycle threw:`, err);
		} finally {
			if (!state.stopped) state.timer = setTimeout(tick, intervalMs);
		}
	};

	state.timer = setTimeout(tick, bootDelayMs);
	pollers.set(key, state);
};

const stopPoller = (key: string): void => {
	const existing = pollers.get(key);

	if (existing) {
		existing.stopped = true;
		if (existing.timer) clearTimeout(existing.timer);
		pollers.delete(key);
	}
};

// Reconcile running pollers against the full set of tenant invite configs. Collapses
// tenants that share a mailbox (host:port:user) into a single poller. Call this on boot
// and on every tenantInviteConfig create/patch/remove. Simple + correct: tear everything
// down and rebuild for the desired mailbox set — config changes are infrequent (admin
// action), so the brief reconnect is irrelevant, and a full rebuild guarantees current
// credentials (we can't reliably diff AES-GCM-encrypted passwords, which re-encrypt each save).
// One representative config per unique mailbox: first enabled config with full IMAP creds
// wins. Reading one shared mailbox needs one credential, unlike sending, where each tenant
// must authenticate as itself.
export const desiredMailboxes = (configs: TenantInviteConfig[]): Map<string, TenantInviteConfig> => {
	const desired = new Map<string, TenantInviteConfig>();

	for (const cfg of configs) {
		if (!cfg.enabled || !cfg.imapHost || !cfg.imapUser || !cfg.imapPass) continue;
		const key = mailboxKey(cfg);

		if (!desired.has(key)) desired.set(key, cfg);
	}

	return desired;
};

export const reconcilePollers = (app: Application, configs: TenantInviteConfig[]): void => {
	stopAllPollers();

	for (const [ key, cfg ] of desiredMailboxes(configs)) {
		startPoller(app, key, cfg);
	}
};

export const stopAllPollers = (): void => {
	for (const key of Array.from(pollers.keys())) {
		stopPoller(key);
	}
};
