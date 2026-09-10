import assert from 'assert';
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';

import { encrypt } from '../../src/invites/crypto';
import { closeAllSenders } from '../../src/invites/sender';
import { registerMeetingEventHandlers, DISPATCH_DEBOUNCE_MS, beforeMeetingRemoveDispatch } from '../../src/invites/dispatcher';
import type { Application, HookContext } from '../../src/declarations';
import { logger } from '../../src/logger';

const KEY = 'f'.repeat(64);
const WAIT_MS = DISPATCH_DEBOUNCE_MS + 300;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Msg { to: string; icalEvent?: { method?: string } }

const realCreateTransport = nodemailer.createTransport;
let sent: Msg[] = [];

const installFake = (): void => {
	sent = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(nodemailer as any).createTransport = () => ({
		sendMail: async (msg: Msg) => {
			sent.push(msg); 

			return {}; 
		},
		close: () => undefined
	});
};

const recipients = (): string[] => sent
	.map((m) => (m.to.match(/<([^>]+)>/)?.[1] ?? m.to))
	.sort();

const inviteConfig = (over: Record<string, unknown> = {}) => ({
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
	updatedAt: 0,
	...over
});

interface Harness {
	app: Application;
	attendeeEvents: EventEmitter;
	patches: Array<{ id: number, data: Record<string, unknown> }>;
}

const harness = (opts: {
	attendees: Array<Record<string, unknown>>;
	sequence?: number;
	status?: string;
	config?: Record<string, unknown> | null;
}): Harness => {
	const attendeeEvents = new EventEmitter();
	const meetingEvents = new EventEmitter();
	const patches: Array<{ id: number, data: Record<string, unknown> }> = [];
	const meetingRow = {
		id: 1,
		tenantId: 1,
		roomId: 1,
		organizerId: 5,
		uid: 'uid-1@meet.example.edu',
		sequence: opts.sequence ?? 0,
		status: opts.status ?? 'CONFIRMED',
		title: 'Board review',
		description: '',
		startsAt: Date.UTC(2026, 8, 10, 10, 0, 0),
		endsAt: Date.UTC(2026, 8, 10, 11, 0, 0),
		timezone: 'UTC',
		locale: 'en'
	};

	const knex = () => ({ where: () => ({ increment: async () => undefined }) });

	const app = {
		get: (k: string) => {
			if (k === 'postgresqlClient') return knex;
			if (k === 'invites') return { encryptionKey: KEY };

			return undefined;
		},
		service: (name: string) => {
			if (name === 'meetingAttendees') {
				return Object.assign(attendeeEvents, {
					find: async () => opts.attendees,
					patch: async (id: number, data: Record<string, unknown>) => {
						patches.push({ id, data });

						return data;
					}
				});
			}
			if (name === 'meetings') return Object.assign(meetingEvents, { get: async () => meetingRow });
			if (name === 'tenantInviteConfigs') {
				return { find: async () => ('config' in opts && opts.config === null ? [] : [ opts.config ?? inviteConfig() ]) };
			}
			if (name === 'rooms') return { get: async () => ({ name: 'board' }) };
			if (name === 'users') return { get: async () => ({ name: 'Alice Organizer' }) };
			if (name === 'tenants') return { get: async () => ({ name: 'Example University' }) };
			if (name === 'tenantFQDNs') return { find: async () => [ { id: 1, fqdn: 'meet.example.edu' } ] };
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any as Application;

	registerMeetingEventHandlers(app);

	return { app, attendeeEvents, patches };
};

describe('dispatch filtering', () => {
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

	it('mails every attendee who has not been told about this revision', async () => {
		const h = harness({
			sequence: 2,
			attendees: [
				{ id: 1, email: 'a@example.org', lastNotifiedSequence: 1 },
				{ id: 2, email: 'b@example.org', lastNotifiedSequence: -1 }
			]
		});

		h.attendeeEvents.emit('created', { id: 2, meetingId: 1 });
		await wait(WAIT_MS);

		assert.deepStrictEqual(recipients(), [ 'a@example.org', 'b@example.org' ]);
	}).timeout(10000);

	it('skips anyone already notified at the current revision', async () => {
		const h = harness({
			sequence: 2,
			attendees: [
				{ id: 1, email: 'a@example.org', lastNotifiedSequence: 2 },
				{ id: 2, email: 'b@example.org', lastNotifiedSequence: -1 }
			]
		});

		h.attendeeEvents.emit('created', { id: 2, meetingId: 1 });
		await wait(WAIT_MS);

		assert.deepStrictEqual(recipients(), [ 'b@example.org' ], 'an up-to-date guest must not be mailed twice');
	}).timeout(10000);

	it('records the notified revision so the next save does not resend', async () => {
		const h = harness({
			sequence: 2,
			attendees: [ { id: 7, email: 'a@example.org', lastNotifiedSequence: -1 } ]
		});

		h.attendeeEvents.emit('created', { id: 7, meetingId: 1 });
		await wait(WAIT_MS);

		assert.deepStrictEqual(h.patches, [ { id: 7, data: { lastNotifiedSequence: 2 } } ]);
	}).timeout(10000);

	it('sends nothing when the tenant has no invite config', async () => {
		const h = harness({
			config: null,
			attendees: [ { id: 1, email: 'a@example.org', lastNotifiedSequence: -1 } ]
		});

		h.attendeeEvents.emit('created', { id: 1, meetingId: 1 });
		await wait(WAIT_MS);

		assert.deepStrictEqual(sent, []);
	}).timeout(10000);

	it('sends nothing when invites are disabled for the tenant', async () => {
		const h = harness({
			config: inviteConfig({ enabled: false }),
			attendees: [ { id: 1, email: 'a@example.org', lastNotifiedSequence: -1 } ]
		});

		h.attendeeEvents.emit('created', { id: 1, meetingId: 1 });
		await wait(WAIT_MS);

		assert.deepStrictEqual(sent, []);
	}).timeout(10000);

	it('sends a CANCEL rather than a REQUEST for a cancelled meeting', async () => {
		const h = harness({
			sequence: 3,
			status: 'CANCELLED',
			attendees: [ { id: 1, email: 'a@example.org', lastNotifiedSequence: 1 } ]
		});

		h.attendeeEvents.emit('created', { id: 1, meetingId: 1 });
		await wait(WAIT_MS);

		assert.strictEqual(sent.length, 1);
		assert.strictEqual(sent[0].icalEvent?.method, 'CANCEL');
	}).timeout(10000);

	it('cancels to everyone, organizer included, before the meeting row is deleted', async () => {
		const h = harness({
			sequence: 1,
			attendees: [
				{ id: 1, email: 'organizer@example.org', lastNotifiedSequence: 1, partstat: 'ACCEPTED' },
				{ id: 2, email: 'guest@example.org', lastNotifiedSequence: 1 }
			]
		});

		await beforeMeetingRemoveDispatch({ id: 1, app: h.app } as unknown as HookContext);

		assert.deepStrictEqual(recipients(), [ 'guest@example.org', 'organizer@example.org' ]);
		assert.ok(sent.every((m) => m.icalEvent?.method === 'CANCEL'));
	});

	it('ignores a remove hook with no id', async () => {
		const h = harness({ attendees: [ { id: 1, email: 'a@example.org', lastNotifiedSequence: -1 } ] });

		await beforeMeetingRemoveDispatch({ app: h.app } as unknown as HookContext);

		assert.deepStrictEqual(sent, []);
	});
});
