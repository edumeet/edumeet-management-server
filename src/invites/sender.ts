import nodemailer, { Transporter } from 'nodemailer';
import { createHash } from 'crypto';
import type { Application } from '../declarations';
import type { Meeting } from '../services/meetings/meetings.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { decrypt } from './crypto';
import { buildRequestIcs, buildCancelIcs } from './icsBuilder';
import { getTemplate } from './templates';

import { logger } from '../logger';

// Keyed per MAILBOX, not per tenant: tenants sharing invitation@example.com must share one
// pooled connection, or the maxConnections/rateLimit caps below are multiplied by the number
// of tenants and blow through the provider's cap. Same reasoning as reconcilePollers on the
// IMAP side. Every connection-shaping field is in the key, credentials included, so configs
// that only look alike never end up sharing a transporter built for the other one.
const senderCache = new Map<string, Transporter>();

const decryptedPass = (app: Application, encrypted: string | undefined): string => {
	if (!encrypted) return '';
	const invites = app.get('invites');

	if (!invites?.encryptionKey) throw new Error('invites.encryptionKey not configured');

	return decrypt(encrypted, invites.encryptionKey);
};

const senderKey = (cfg: TenantInviteConfig, pass: string): string => [
	cfg.smtpHost,
	cfg.smtpPort,
	cfg.smtpSecure ? 'tls' : 'plain',
	cfg.smtpUser,
	createHash('sha256').update(pass)
		.digest('hex')
].join(':');

const getTransporter = (app: Application, tenantConfig: TenantInviteConfig): Transporter => {
	const pass = decryptedPass(app, tenantConfig.smtpPass);
	const key = senderKey(tenantConfig, pass);
	const cached = senderCache.get(key);

	if (cached) return cached;

	// Timeouts prevent a firewall blackhole or provider outage from hanging the
	// dispatcher for minutes. Values are generous vs. the 10s tester bounds — real
	// send operations with large recipient lists can legitimately take longer.
	//
	// Pool + rate limit: the dispatcher fires sendInviteEmail for every attendee via
	// Promise.all. Without pooling that's N simultaneous SMTP connections + a burst of
	// N messages, which trips provider caps (Gandi etc.) on a large meeting. Pooling
	// funnels everything through a single connection; rateLimit/rateDelta cap the send
	// rate; nodemailer queues the rest internally, so the dispatcher's Promise.all keeps
	// working unchanged. This smooths bursts — it does NOT protect against per-day caps
	// (that would need a persistent cross-hour queue).
	const transporter = nodemailer.createTransport({
		host: tenantConfig.smtpHost,
		port: tenantConfig.smtpPort,
		secure: tenantConfig.smtpSecure,
		auth: {
			user: tenantConfig.smtpUser,
			pass
		},
		connectionTimeout: 30000,
		greetingTimeout: 30000,
		socketTimeout: 60000,
		pool: true,
		// one connection per mailbox, shared across tenants using it
		maxConnections: 1,
		// recycle the connection after 100 messages
		maxMessages: 100,
		// at most 10 messages per 1000 ms
		rateLimit: 10,
		rateDelta: 1000
	});

	senderCache.set(key, transporter);

	return transporter;
};

const closeSender = (key: string): void => {
	const existing = senderCache.get(key);

	if (!existing) return;
	try { existing.close(); } catch { /* noop */ }
	senderCache.delete(key);
};

// Mirrors reconcilePollers: closes only the transporters no live config still wants. Closing
// on every config write instead would drop mail already queued on a shared transporter for
// the other tenants using it, including when the edit never touched SMTP at all.
export const reconcileSenders = (app: Application, configs: TenantInviteConfig[]): void => {
	const live = new Set<string>();

	for (const cfg of configs) {
		if (!cfg.enabled) continue;
		try {
			live.add(senderKey(cfg, decryptedPass(app, cfg.smtpPass)));
		} catch (err) {
			logger.warn(`[invites/sender] cannot key tenant ${cfg.tenantId} config; its cached sender is dropped:`, err);
		}
	}

	for (const key of [ ...senderCache.keys() ]) {
		if (!live.has(key)) closeSender(key);
	}
};

export const closeAllSenders = (): void => {
	for (const key of [ ...senderCache.keys() ]) closeSender(key);
};

const lookupRoomUrl = async (app: Application, tenantId: number, roomName: string): Promise<string> => {
	// Ordered, so a tenant with several FQDNs gets the same join URL on every revision of a
	// meeting; an unordered pick could make LOCATION change between the REQUEST and an update.
	const fqdns = await app.service('tenantFQDNs').find({
		paginate: false,
		query: { tenantId, $sort: { id: 1 }, $limit: 1 }
	});
	const list = Array.isArray(fqdns) ? fqdns : (fqdns as { data: unknown[] }).data;
	const primary = (list as Array<{ fqdn: string }>)[0];

	const host = primary?.fqdn ?? 'meet.example.com';

	return `https://${host}/${roomName}`;
};

export interface SendOptions {
	method: 'REQUEST' | 'CANCEL';
	meeting: Meeting;
	attendee: MeetingAttendee; // the recipient
	allAttendees: MeetingAttendee[]; // full guest list included in ICS ATTENDEE lines
	tenantConfig: TenantInviteConfig;
	roomName: string;
	organizerUserName?: string;
	tenantName?: string;
}

export const sendInviteEmail = async (app: Application, opts: SendOptions): Promise<void> => {
	const { method, meeting, attendee, allAttendees, tenantConfig, roomName, organizerUserName, tenantName } = opts;

	try {
		const transporter = getTransporter(app, tenantConfig);
		const roomUrl = await lookupRoomUrl(app, tenantConfig.tenantId, roomName);
		const template = getTemplate(meeting.locale || 'en');
		// Postgres bigint columns come back as strings from knex — coerce before Date()
		// or `new Date()` misinterprets the numeric string as an ISO date → Invalid Date.
		const startsDate = new Date(Number(meeting.startsAt));
		const endsDate = new Date(Number(meeting.endsAt));
		// Map our internal locale codes to BCP 47 tags Intl understands (cn → zh-CN etc.).
		// Anything not in the map passes through; Intl falls back to en for unknown tags.
		const intlLocaleMap: Record<string, string> = { cn: 'zh-CN', tw: 'zh-TW', dk: 'da' };
		const intlLocale = intlLocaleMap[meeting.locale || 'en'] ?? (meeting.locale || 'en');
		// `dateStyle` and `timeZoneName` aren't always honored together, so format the
		// date and time portions separately and combine. Output:
		//   en: "Thursday, April 30, 2026, 4:00 PM CEST"
		//   pl: "czwartek, 30 kwietnia 2026, 16:00 CEST"
		// The ICS attachment carries the canonical UTC time for actual scheduling — these
		// strings are only the human-readable hint in the plain-text body.
		// Note: ECMA-402 forbids combining the `timeStyle` shortcut with individual
		// options like `timeZoneName`. We need the timezone abbreviation in the
		// rendered string, so use individual hour/minute fields for the time formatter.
		// `dateStyle: 'full'` alone is fine and produces the localized weekday/date form.
		// eslint-disable-next-line no-unused-vars
		const tryBuildFormatter = (locale: string, tz: string): ((d: Date) => string) | null => {
			try {
				const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: tz });
				const fmtTime = new Intl.DateTimeFormat(locale, {
					hour: 'numeric',
					minute: '2-digit',
					timeZone: tz,
					timeZoneName: 'short'
				});

				return (d: Date) => `${fmtDate.format(d)}, ${fmtTime.format(d)}`;
			} catch {
				return null;
			}
		};
		// Defensive fallback if the meeting carries a malformed locale/timezone.
		let formatWhen = tryBuildFormatter(intlLocale, meeting.timezone || 'UTC');

		if (!formatWhen) {
			logger.warn(`[invites/sender] meeting ${meeting.id} has invalid locale/timezone (locale=${meeting.locale} tz=${meeting.timezone}); using en-US/UTC fallback`);
			formatWhen = tryBuildFormatter('en-US', 'UTC')
				// Last-ditch — should never trigger since en-US/UTC is always valid in V8.
				?? ((d: Date) => d.toISOString());
		}
		const startsStr = formatWhen(startsDate);
		const endsStr = formatWhen(endsDate);

		// "Alice via Tenant Name" — always include the organizing user + tenant so attendees
		// can tell invites apart even if multiple tenants share an SMTP mailbox.
		const userLabel = organizerUserName || tenantConfig.organizerName || 'edumeet';
		const tenantLabel = tenantName || tenantConfig.organizerName || 'edumeet';
		const fromDisplay = `${userLabel} via ${tenantLabel}`;

		const ctx = {
			title: meeting.title,
			description: meeting.description,
			roomUrl,
			organizerName: userLabel,
			startsAt: startsStr,
			endsAt: endsStr
		};
		const icsInput = {
			meeting,
			// Industry-standard iTIP: every recipient sees the full guest list in their ICS
			attendees: allAttendees,
			tenantConfig,
			roomUrl,
			organizerUserName: userLabel,
			description: template.eventDescription(ctx)
		};
		const ics = method === 'REQUEST' ? buildRequestIcs(icsInput) : buildCancelIcs(icsInput);
		const subject = method === 'REQUEST'
			? template.subjectRequest(meeting.title)
			: template.subjectCancel(meeting.title);
		const text = method === 'REQUEST' ? template.bodyRequest(ctx) : template.bodyCancel(ctx);
		// Mail clients that do not render text/calendar fall back to the richest body they
		// understand, so the HTML alternative is what most webmail and phone users see.
		const html = method === 'REQUEST' ? template.htmlRequest(ctx) : template.htmlCancel(ctx);

		await transporter.sendMail({
			from: `"${fromDisplay}" <${tenantConfig.organizerAddress}>`,
			to: attendee.name ? `"${attendee.name}" <${attendee.email}>` : attendee.email,
			subject,
			text,
			html,
			icalEvent: {
				method,
				content: ics
			}
		});

		// record that we've notified this attendee of the current sequence
		if (method === 'REQUEST' && attendee.id) {
			await app.service('meetingAttendees').patch(attendee.id, {
				lastNotifiedSequence: meeting.sequence
			}, { provider: undefined });
		}
	} catch (err) {
		logger.error(`[invites/sender] failed to send ${method} for meeting ${meeting.id} to ${attendee.email}:`, err);
	}
};
