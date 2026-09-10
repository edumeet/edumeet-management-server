import assert from 'assert';
import nodemailer from 'nodemailer';

import { encrypt } from '../../src/invites/crypto';
import { sendInviteEmail, closeAllSenders } from '../../src/invites/sender';
import { getTemplate } from '../../src/invites/templates';
import type { Application } from '../../src/declarations';
import type { Meeting } from '../../src/services/meetings/meetings.schema';
import type { MeetingAttendee } from '../../src/services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { logger } from '../../src/logger';

const KEY = 'e'.repeat(64);

// every locale the client ships templates for
const LOCALES = [
	'cn', 'cs', 'de', 'dk', 'el', 'en', 'es', 'fr', 'hi', 'hr', 'hu',
	'it', 'kk', 'lv', 'nb', 'pl', 'pt', 'ro', 'ru', 'tr', 'tw', 'uk'
];

interface Sent {
	from: string;
	to: string;
	subject: string;
	text: string;
	icalEvent?: { method?: string, content?: string };
}

const realCreateTransport = nodemailer.createTransport;
let sent: Sent[] = [];

const installFake = (): void => {
	sent = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(nodemailer as any).createTransport = () => ({
		sendMail: async (msg: Sent) => {
			sent.push(msg); 

			return {}; 
		},
		close: () => undefined
	});
};

const cfg = (): TenantInviteConfig => ({
	id: 1,
	tenantId: 1,
	enabled: true,
	organizerAddress: 'invitation@example.com',
	organizerName: 'Invites',
	smtpHost: 'smtp.example.com',
	smtpPort: 465,
	smtpSecure: true,
	smtpUser: 'invitation@example.com',
	smtpPass: encrypt('secret', KEY),
	createdAt: 0,
	updatedAt: 0
} as unknown as TenantInviteConfig);

const meeting = (over: Record<string, unknown> = {}): Meeting => ({
	id: 1,
	roomId: 1,
	tenantId: 1,
	organizerId: 1,
	uid: 'uid-1@meet.example.edu',
	sequence: 0,
	status: 'CONFIRMED',
	title: 'Board review',
	description: 'Quarterly numbers',
	startsAt: Date.UTC(2026, 8, 10, 10, 0, 0),
	endsAt: Date.UTC(2026, 8, 10, 11, 0, 0),
	timezone: 'Europe/Warsaw',
	locale: 'en',
	createdAt: 0,
	updatedAt: 0,
	...over
} as unknown as Meeting);

const attendee = (): MeetingAttendee => ({
	id: 1,
	meetingId: 1,
	email: 'guest@example.org',
	name: 'Guest One',
	partstat: 'NEEDS-ACTION',
	lastNotifiedSequence: -1
} as unknown as MeetingAttendee);

const app = (): Application => ({
	get: (k: string) => (k === 'invites' ? { encryptionKey: KEY } : undefined),
	service: (name: string) => {
		if (name === 'tenantFQDNs') return { find: async () => [ { id: 1, fqdn: 'meet.example.edu' } ] };
		if (name === 'meetingAttendees') return { patch: async () => ({}) };
		throw new Error(`unexpected service ${name}`);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as Application;

const send = async (over: Record<string, unknown>, method: 'REQUEST' | 'CANCEL' = 'REQUEST'): Promise<void> => {
	await sendInviteEmail(app(), {
		method,
		meeting: meeting(over),
		attendee: attendee(),
		allAttendees: [ attendee() ],
		tenantConfig: cfg(),
		roomName: 'board',
		organizerUserName: 'Alice Organizer',
		tenantName: 'Example University'
	});
};

describe('invite rendering across locales', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => {
		logger.transports.forEach((t) => (t.silent = false));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(nodemailer as any).createTransport = realCreateTransport;
	});

	beforeEach(() => {
		closeAllSenders();
		installFake();
	});

	// sendInviteEmail swallows its own errors, so a throw shows up as no message at all.
	// That makes "exactly one message was sent" the assertion that catches a render crash,
	// which is how the ECMA-402 timeStyle plus timeZoneName combination used to fail.
	for (const locale of LOCALES) {
		it(`renders a REQUEST in ${locale}`, async () => {
			await send({ locale });

			assert.strictEqual(sent.length, 1, `no message produced for locale ${locale}`);
			assert.ok(sent[0].subject.trim().length > 0, `empty subject for ${locale}`);
			assert.ok(sent[0].text.trim().length > 0, `empty body for ${locale}`);
			assert.ok(sent[0].text.includes('https://meet.example.edu/board'), `missing join url for ${locale}`);
		});
	}

	it('renders a CANCEL too', async () => {
		await send({ locale: 'pl' }, 'CANCEL');

		assert.strictEqual(sent.length, 1);
		assert.strictEqual(sent[0].icalEvent?.method, 'CANCEL');
	});

	it('falls back to en for an unknown locale', async () => {
		await send({ locale: 'zz' });

		assert.strictEqual(sent.length, 1);
		assert.strictEqual(sent[0].subject, getTemplate('en').subjectRequest('Board review'));
	});

	it('still sends when the meeting timezone is unusable', async () => {
		await send({ timezone: 'Not/AZone' });

		assert.strictEqual(sent.length, 1, 'a bad timezone must fall back, not lose the invite');
	});

	it('still sends when the locale is unusable', async () => {
		await send({ locale: 'not a locale tag' });

		assert.strictEqual(sent.length, 1);
	});

	it('names both the organizing user and the tenant in the From display', async () => {
		await send({ locale: 'en' });

		assert.ok(sent[0].from.includes('Alice Organizer'), sent[0].from);
		assert.ok(sent[0].from.includes('Example University'), sent[0].from);
		// the envelope stays on the mailbox that collects replies
		assert.ok(sent[0].from.includes('<invitation@example.com>'), sent[0].from);
		assert.ok(sent[0].to.includes('guest@example.org'), sent[0].to);
	});

	it('builds the join url from the lowest-id FQDN, deterministically', async () => {
		let query: Record<string, unknown> = {};
		const multi = {
			get: (k: string) => (k === 'invites' ? { encryptionKey: KEY } : undefined),
			service: (name: string) => {
				if (name === 'tenantFQDNs') {
					return {
						find: async (params: { query: Record<string, unknown> }) => {
							query = params.query;

							return [ { id: 2, fqdn: 'first.example.edu' }, { id: 9, fqdn: 'second.example.edu' } ];
						}
					};
				}
				if (name === 'meetingAttendees') return { patch: async () => ({}) };
				throw new Error(`unexpected service ${name}`);
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any as Application;

		await sendInviteEmail(multi, {
			method: 'REQUEST',
			meeting: meeting({ locale: 'en' }),
			attendee: attendee(),
			allAttendees: [ attendee() ],
			tenantConfig: cfg(),
			roomName: 'board'
		});

		assert.deepStrictEqual(query.$sort, { id: 1 }, 'an unordered pick could change LOCATION between revisions');
		assert.strictEqual(query.$limit, 1);
		assert.ok(sent[0].text.includes('https://first.example.edu/board'), sent[0].text);
		assert.match(String(sent[0].icalEvent?.content), /^LOCATION:https:\/\/first\.example\.edu\/board$/m);
	});

	it('attaches the calendar part with the matching method', async () => {
		await send({ locale: 'en' });

		assert.strictEqual(sent[0].icalEvent?.method, 'REQUEST');
		assert.match(String(sent[0].icalEvent?.content), /^METHOD:REQUEST$/m);
	});

	describe('getTemplate', () => {
		it('returns a usable template for every shipped locale', () => {
			for (const locale of LOCALES) {
				const t = getTemplate(locale);

				assert.ok(t.subjectRequest('T').length > 0, `subjectRequest empty for ${locale}`);
				assert.ok(t.subjectCancel('T').length > 0, `subjectCancel empty for ${locale}`);
			}
		});

		it('falls back to en rather than returning undefined', () => {
			assert.strictEqual(getTemplate('zz').subjectRequest('T'), getTemplate('en').subjectRequest('T'));
		});
	});
});
