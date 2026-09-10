import assert from 'assert';
import nodemailer from 'nodemailer';

import { encrypt } from '../../src/invites/crypto';
import { sendInviteEmail, reconcileSenders, closeAllSenders } from '../../src/invites/sender';
import type { Application } from '../../src/declarations';
import type { Meeting } from '../../src/services/meetings/meetings.schema';
import type { MeetingAttendee } from '../../src/services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { logger } from '../../src/logger';

const KEY = 'a'.repeat(64);

interface FakeTransport {
	options: Record<string, unknown>;
	closed: boolean;
	sent: number;
}

// sender.ts calls nodemailer.createTransport on the shared module object, so replacing the
// property here is observed inside the module under test without a mocking library.
const realCreateTransport = nodemailer.createTransport;
let created: FakeTransport[] = [];

const installFakeTransport = (): void => {
	created = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(nodemailer as any).createTransport = (options: Record<string, unknown>) => {
		const t: FakeTransport = { options, closed: false, sent: 0 };

		created.push(t);

		return {
			sendMail: async () => {
				t.sent++; 

				return {}; 
			},
			close: () => { t.closed = true; },
			verify: async () => true
		};
	};
};

const cfg = (over: Partial<TenantInviteConfig> = {}): TenantInviteConfig => ({
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
	updatedAt: 0,
	...over
});

const meeting = (): Meeting => ({
	id: 1,
	roomId: 1,
	tenantId: 1,
	organizerId: 1,
	uid: 'uid-1@example.com',
	sequence: 0,
	status: 'CONFIRMED',
	title: 'Test',
	description: '',
	startsAt: Date.UTC(2026, 8, 10, 10, 0, 0),
	endsAt: Date.UTC(2026, 8, 10, 11, 0, 0),
	timezone: 'UTC',
	locale: 'en',
	rrule: undefined,
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
		if (name === 'tenantFQDNs') return { find: async () => [] };
		if (name === 'meetingAttendees') return { patch: async () => ({}) };
		throw new Error(`unexpected service ${name}`);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as Application;

const send = async (app: Application, tenantConfig: TenantInviteConfig): Promise<void> => {
	await sendInviteEmail(app, {
		method: 'REQUEST',
		meeting: meeting(),
		attendee: attendee(),
		allAttendees: [ attendee() ],
		tenantConfig,
		roomName: 'room'
	});
};

describe('invites sender transporter cache', () => {
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

	it('shares one transporter between tenants on the same mailbox', async () => {
		const app = fakeApp();

		await send(app, cfg({ id: 1, tenantId: 1 }));
		await send(app, cfg({ id: 2, tenantId: 2 }));

		assert.strictEqual(created.length, 1, 'expected the second tenant to reuse the pooled transporter');
		assert.strictEqual(created[0].sent, 2);
	});

	it('keeps the pooled rate limit on the shared transporter', async () => {
		const app = fakeApp();

		await send(app, cfg());

		assert.strictEqual(created[0].options.pool, true);
		assert.strictEqual(created[0].options.maxConnections, 1);
		assert.strictEqual(created[0].options.rateLimit, 10);
	});

	it('does not share when TLS differs on the same host, port and user', async () => {
		const app = fakeApp();

		await send(app, cfg({ tenantId: 1, smtpSecure: true }));
		await send(app, cfg({ tenantId: 2, smtpSecure: false }));

		assert.strictEqual(created.length, 2, 'a plaintext config must not reuse a TLS transporter');
		assert.strictEqual(created[0].options.secure, true);
		assert.strictEqual(created[1].options.secure, false);
	});

	it('does not share when the password differs on the same mailbox', async () => {
		const app = fakeApp();

		await send(app, cfg({ tenantId: 1, smtpPass: encrypt('secret', KEY) }));
		await send(app, cfg({ tenantId: 2, smtpPass: encrypt('other', KEY) }));

		assert.strictEqual(created.length, 2, 'one tenant credential must never be reused for another');
	});

	it('rebuilds after the stored password changes', async () => {
		const app = fakeApp();

		await send(app, cfg({ smtpPass: encrypt('secret', KEY) }));
		await send(app, cfg({ smtpPass: encrypt('rotated', KEY) }));

		assert.strictEqual(created.length, 2);
	});

	describe('reconcileSenders', () => {
		it('leaves a transporter a live config still wants', async () => {
			const app = fakeApp();
			const live = cfg();

			await send(app, live);
			reconcileSenders(app, [ live ]);

			assert.strictEqual(created[0].closed, false);
		});

		it('closes a transporter whose config is gone', async () => {
			const app = fakeApp();

			await send(app, cfg());
			reconcileSenders(app, []);

			assert.strictEqual(created[0].closed, true);
		});

		it('closes a transporter whose config was disabled', async () => {
			const app = fakeApp();
			const config = cfg();

			await send(app, config);
			reconcileSenders(app, [ { ...config, enabled: false } ]);

			assert.strictEqual(created[0].closed, true);
		});

		it('keeps a shared transporter alive while any tenant still uses it', async () => {
			const app = fakeApp();
			const a = cfg({ id: 1, tenantId: 1 });
			const b = cfg({ id: 2, tenantId: 2 });

			await send(app, a);
			await send(app, b);
			assert.strictEqual(created.length, 1);

			// tenant 1 edits something unrelated and is momentarily the only config seen
			reconcileSenders(app, [ b ]);

			assert.strictEqual(created[0].closed, false, 'tenant 2 queued mail must not be dropped');
		});
	});
});
