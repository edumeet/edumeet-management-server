import assert from 'assert';
import nodemailer from 'nodemailer';

import { encrypt } from '../../src/invites/crypto';
import { sendInviteEmail, closeAllSenders, buildRoomUrl } from '../../src/invites/sender';
import type { Application } from '../../src/declarations';
import type { Meeting } from '../../src/services/meetings/meetings.schema';
import type { MeetingAttendee } from '../../src/services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { logger } from '../../src/logger';

const KEY = 'b'.repeat(64);
const TOKEN = 'ABCDEFGHJKLM';

interface SentMail {
	text: string;
	html: string;
	icalEvent: { method: string, content: string };
}

const realCreateTransport = nodemailer.createTransport;
let sent: SentMail[] = [];

const installFakeTransport = (): void => {
	sent = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(nodemailer as any).createTransport = () => ({
		sendMail: async (mail: SentMail) => {
			sent.push(mail);

			return {};
		},
		close: () => undefined,
		verify: async () => true
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
	imapHost: undefined,
	imapPort: undefined,
	imapSecure: undefined,
	imapUser: undefined,
	imapPass: undefined,
	createdAt: 0,
	updatedAt: 0
});

const meeting = (): Meeting => ({
	id: 1,
	roomId: 1,
	tenantId: 1,
	organizerId: 1,
	uid: 'c4a4d0a2-2f4a-4a5c-9d1c-3b2e7f8a9b10',
	meetingToken: TOKEN,
	sequence: 0,
	status: 'CONFIRMED',
	title: 'Board',
	description: '',
	startsAt: Date.UTC(2026, 8, 10, 10, 0, 0),
	endsAt: Date.UTC(2026, 8, 10, 11, 0, 0),
	timezone: 'UTC',
	locale: 'en',
	createdAt: 0,
	updatedAt: 0
} as unknown as Meeting);

const attendee = (): MeetingAttendee => ({
	id: 1,
	meetingId: 1,
	email: 'guest@example.org',
	name: 'Guest',
	partstat: 'NEEDS-ACTION',
	lastNotifiedSequence: -1
} as unknown as MeetingAttendee);

const fakeApp = (): Application => ({
	get: (k: string) => (k === 'invites' ? { encryptionKey: KEY } : undefined),
	service: (name: string) => {
		if (name === 'tenantFQDNs') return { find: async () => [ { fqdn: 'meet.example.edu' } ] };
		if (name === 'meetingAttendees') return { patch: async () => ({}) };
		throw new Error(`unexpected service ${name}`);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as Application;

const send = async (meetingsOnly: boolean | undefined, method: 'REQUEST' | 'CANCEL' = 'REQUEST'): Promise<SentMail> => {
	await sendInviteEmail(fakeApp(), {
		method,
		meeting: meeting(),
		attendee: attendee(),
		allAttendees: [ attendee() ],
		tenantConfig: cfg(),
		roomName: 'board',
		meetingsOnly
	});
	assert.strictEqual(sent.length, 1);

	return sent[0];
};

const BARE = 'https://meet.example.edu/board';
const TOKENED = `${BARE}?meetingToken=${TOKEN}`;

describe('invite link for a meetings-only room', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => {
		logger.transports.forEach((t) => (t.silent = false));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(nodemailer as any).createTransport = realCreateTransport;
	});
	beforeEach(() => {
		closeAllSenders();
		installFakeTransport();
	});

	it('builds the bare link without a token and the tokened link with one', () => {
		assert.strictEqual(buildRoomUrl('meet.example.edu', 'board'), BARE);
		assert.strictEqual(buildRoomUrl('meet.example.edu', 'board', TOKEN), TOKENED);
	});

	it('url-encodes the token rather than trusting it', () => {
		assert.strictEqual(buildRoomUrl('h', 'r', 'a&b=c'), 'https://h/r?meetingToken=a%26b%3Dc');
	});

	it('carries the token in LOCATION, the plain body and the HTML button when the room is meetings only', async () => {
		const mail = await send(true);

		assert.ok(mail.icalEvent.content.includes(`LOCATION:${TOKENED}`), mail.icalEvent.content);
		assert.ok(mail.text.includes(TOKENED), mail.text);
		assert.ok(mail.html.includes(`href="${TOKENED}"`), mail.html);
	});

	it('sends the bare link when the room is not meetings only', async () => {
		const mail = await send(false);

		assert.ok(mail.icalEvent.content.includes(`LOCATION:${BARE}\r\n`), mail.icalEvent.content);
		assert.ok(!mail.icalEvent.content.includes('meetingToken'));
		assert.ok(!mail.text.includes('meetingToken'));
		assert.ok(!mail.html.includes('meetingToken'));
	});

	it('sends the bare link when the flag is not given at all', async () => {
		const mail = await send(undefined);

		assert.ok(!mail.icalEvent.content.includes('meetingToken'));
	});

	it('keeps the tokened LOCATION on a CANCEL so the calendar entry matches the REQUEST', async () => {
		const mail = await send(true, 'CANCEL');

		assert.ok(mail.icalEvent.content.includes(`LOCATION:${TOKENED}`));
	});
});
