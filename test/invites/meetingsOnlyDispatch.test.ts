import assert from 'assert';
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';

import { encrypt } from '../../src/invites/crypto';
import { closeAllSenders } from '../../src/invites/sender';
import { registerMeetingEventHandlers, DISPATCH_DEBOUNCE_MS, beforeMeetingRemoveDispatch } from '../../src/invites/dispatcher';
import { rememberMeetingsOnly, resendInvitesOnMeetingsOnlyChange } from '../../src/hooks/meetingsOnlyChange';
import type { Application, HookContext } from '../../src/declarations';
import { logger } from '../../src/logger';

const KEY = 'e'.repeat(64);
const WAIT_MS = DISPATCH_DEBOUNCE_MS + 300;
const TOKEN = 'ABCDEFGHJKLM';
const TOKENED = `https://meet.example.edu/board?meetingToken=${TOKEN}`;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Msg { to: string; text: string; icalEvent: { method: string, content: string } }

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

interface Harness {
	app: Application;
	meetingEvents: EventEmitter;
	room: { name: string, meetingsOnly: boolean | number };
	attendees: Array<{ id: number, email: string, lastNotifiedSequence: number }>;
	sequence: number;
}

const harness = (meetingsOnly: boolean | number, notified: boolean): Harness => {
	const meetingEvents = new EventEmitter();
	const room = { name: 'board', meetingsOnly };
	const attendees = [ { id: 1, email: 'guest@example.org', lastNotifiedSequence: notified ? 0 : -1 } ];
	const state = { sequence: 0 };

	const knex = () => ({
		where: () => ({
			increment: async () => { state.sequence++; },
			select: async () => [ { id: 1, startsAt: Date.UTC(2099, 8, 10, 10, 0, 0), endsAt: Date.UTC(2099, 8, 10, 11, 0, 0), rrule: null, timezone: 'UTC' } ],
			first: async () => ({ meetingsOnly: room.meetingsOnly })
		})
	});

	const app = {
		get: (k: string) => {
			if (k === 'postgresqlClient') return knex;
			if (k === 'invites') return { encryptionKey: KEY };

			return undefined;
		},
		service: (name: string) => {
			if (name === 'meetingAttendees') {
				return Object.assign(new EventEmitter(), {
					find: async () => attendees,
					patch: async (id: number, data: { lastNotifiedSequence: number }) => {
						const a = attendees.find((x) => x.id === id);

						if (a) a.lastNotifiedSequence = data.lastNotifiedSequence;

						return data;
					}
				});
			}
			if (name === 'meetings') {
				return Object.assign(meetingEvents, {
					get: async () => ({
						id: 1,
						tenantId: 1,
						roomId: 1,
						organizerId: 5,
						uid: 'c4a4d0a2-2f4a-4a5c-9d1c-3b2e7f8a9b10',
						meetingToken: TOKEN,
						sequence: state.sequence,
						status: 'CONFIRMED',
						title: 'Board',
						description: '',
						startsAt: Date.UTC(2026, 8, 10, 10, 0, 0),
						endsAt: Date.UTC(2026, 8, 10, 11, 0, 0),
						timezone: 'UTC',
						locale: 'en'
					})
				});
			}
			if (name === 'tenantInviteConfigs') {
				return { find: async () => [ {
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
				} ] };
			}
			if (name === 'rooms') return { get: async () => room };
			if (name === 'users') return { get: async () => ({ name: 'Alice Organizer' }) };
			if (name === 'tenants') return { get: async () => ({ name: 'Example University' }) };
			if (name === 'tenantFQDNs') return { find: async () => [ { id: 1, fqdn: 'meet.example.edu' } ] };
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any as Application;

	registerMeetingEventHandlers(app);

	return { app, meetingEvents, room, attendees, get sequence() { return state.sequence; } };
};

describe('meetings-only rooms and the invite pipeline', () => {
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

	it('mails the tokened link for a meeting created in a meetings-only room', async () => {
		const h = harness(true, false);

		h.meetingEvents.emit('created', { id: 1 });
		await wait(WAIT_MS);

		assert.strictEqual(sent.length, 1);
		assert.ok(sent[0].icalEvent.content.includes(`LOCATION:${TOKENED}`), sent[0].icalEvent.content);
		assert.ok(sent[0].text.includes(TOKENED));
	}).timeout(10000);

	it('reads the flag as MySQL returns it', async () => {
		const h = harness(1, false);

		h.meetingEvents.emit('created', { id: 1 });
		await wait(WAIT_MS);

		assert.ok(sent[0].icalEvent.content.includes(`LOCATION:${TOKENED}`));
	}).timeout(10000);

	it('mails the bare link otherwise', async () => {
		const h = harness(false, false);

		h.meetingEvents.emit('created', { id: 1 });
		await wait(WAIT_MS);

		assert.ok(sent[0].icalEvent.content.includes('LOCATION:https://meet.example.edu/board\r\n'));
		assert.ok(!sent[0].icalEvent.content.includes('meetingToken'));
	}).timeout(10000);

	it('re-sends with the tokened link and a higher SEQUENCE when the room switches the mode on', async () => {
		const h = harness(false, true);
		const ctx = { app: h.app, id: 1, params: {}, data: { meetingsOnly: true } } as unknown as HookContext;

		await rememberMeetingsOnly(ctx);
		h.room.meetingsOnly = true;
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: true } } as HookContext);
		await wait(WAIT_MS);

		assert.strictEqual(h.sequence, 1, 'attendees who already had the invite need a new revision');
		assert.strictEqual(sent.length, 1);
		assert.ok(sent[0].icalEvent.content.includes(`LOCATION:${TOKENED}`));
		assert.ok(sent[0].icalEvent.content.includes('SEQUENCE:1'), sent[0].icalEvent.content);
	}).timeout(10000);

	it('re-sends with the bare link when the room switches the mode off', async () => {
		const h = harness(true, true);
		const ctx = { app: h.app, id: 1, params: {}, data: { meetingsOnly: false } } as unknown as HookContext;

		await rememberMeetingsOnly(ctx);
		h.room.meetingsOnly = false;
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: false } } as HookContext);
		await wait(WAIT_MS);

		assert.strictEqual(sent.length, 1);
		assert.ok(!sent[0].icalEvent.content.includes('meetingToken'));
	}).timeout(10000);

	it('keeps the tokened LOCATION on the CANCEL sent when the meeting is deleted', async () => {
		const h = harness(true, true);

		await beforeMeetingRemoveDispatch({ app: h.app, id: 1, params: {} } as unknown as HookContext);

		assert.strictEqual(sent.length, 1);
		assert.strictEqual(sent[0].icalEvent.method, 'CANCEL');
		assert.ok(sent[0].icalEvent.content.includes(`LOCATION:${TOKENED}`));
	});

	it('never fails the room patch when scheduling the re-send fails', async () => {
		const h = harness(false, true);
		// eslint-disable-next-line no-unused-vars
		const original = h.app as unknown as { get: (key: string) => unknown };
		const broken = {
			...h.app,
			get: (k: string) => (k === 'postgresqlClient' ? () => { throw new Error('db down'); } : original.get(k))
		} as unknown as Application;

		await resendInvitesOnMeetingsOnlyChange({ app: broken, id: 1, params: { meetingsOnlyBefore: false }, result: { meetingsOnly: true } } as unknown as HookContext);
	});
});
