import assert from 'assert';
import { EventEmitter } from 'events';

import { encrypt } from '../../src/invites/crypto';
import { startInviteWorkers, stopInviteWorkers } from '../../src/invites/registry';
import { stopAllPollers } from '../../src/invites/replyPoller';
import { closeAllSenders } from '../../src/invites/sender';
import type { Application } from '../../src/declarations';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { logger } from '../../src/logger';

const KEY = 'c3'.repeat(32);
const BOOT_MS = 40;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const afterBoot = (): Promise<void> => sleep(BOOT_MS + 120);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const imapModule = require('imapflow');
const realImapFlow = imapModule.ImapFlow;

let connects = 0;

const installImap = (): void => {
	connects = 0;
	imapModule.ImapFlow = class {
		on(): void { /* noop */ }
		async connect(): Promise<void> {
			connects++;
			throw new Error('ETIMEDOUT');
		}
		async logout(): Promise<void> { /* noop */ }
	};
};

const cfg = (over: Partial<TenantInviteConfig> = {}): TenantInviteConfig => ({
	id: 1,
	tenantId: 1,
	enabled: true,
	organizerAddress: 'invitation@example.com',
	smtpHost: 'smtp.example.com',
	smtpPort: 465,
	smtpSecure: true,
	smtpUser: 'invitation@example.com',
	smtpPass: encrypt('secret', KEY),
	imapHost: 'imap.example.com',
	imapPort: 993,
	imapSecure: true,
	imapUser: 'invitation@example.com',
	imapPass: encrypt('secret', KEY),
	createdAt: 0,
	updatedAt: 0,
	...over
} as unknown as TenantInviteConfig);

interface Harness {
	app: Application;
	configEvents: EventEmitter;
	attendeeEvents: EventEmitter;
	meetingEvents: EventEmitter;
	loads: () => number;
	// eslint-disable-next-line no-unused-vars
	setConfigs: (next: TenantInviteConfig[]) => void;
	failNextLoad: () => void;
}

const harness = (opts: {
	invites?: Record<string, unknown> | undefined;
	configs?: TenantInviteConfig[];
} = {}): Harness => {
	const configEvents = new EventEmitter();
	const attendeeEvents = new EventEmitter();
	const meetingEvents = new EventEmitter();
	const state = {
		configs: opts.configs ?? [ cfg() ],
		loads: 0,
		failNext: false
	};

	const invites = 'invites' in opts
		? opts.invites
		: { encryptionKey: KEY, rsvpTokenSecret: 'rsvp', imapPollBootDelayMs: BOOT_MS, imapPollIntervalMs: 60000 };

	const app = {
		get: (k: string) => (k === 'invites' ? invites : undefined),
		service: (name: string) => {
			if (name === 'tenantInviteConfigs') {
				return Object.assign(configEvents, {
					find: async () => {
						state.loads++;
						if (state.failNext) {
							state.failNext = false;
							throw new Error('config read failed');
						}

						return state.configs;
					}
				});
			}
			if (name === 'meetingAttendees') return Object.assign(attendeeEvents, { find: async () => [] });
			if (name === 'meetings') return Object.assign(meetingEvents, { get: async () => ({}) });
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any as Application;

	return {
		app,
		configEvents,
		attendeeEvents,
		meetingEvents,
		loads: () => state.loads,
		setConfigs: (next) => { state.configs = next; },
		failNextLoad: () => { state.failNext = true; }
	};
};

describe('invite worker registry', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => {
		logger.transports.forEach((t) => (t.silent = false));
		imapModule.ImapFlow = realImapFlow;
	});

	beforeEach(installImap);
	afterEach(() => {
		stopAllPollers();
		closeAllSenders();
	});

	describe('startup guard', () => {
		it('does nothing at all without an encryption key', async () => {
			const h = harness({ invites: { rsvpTokenSecret: 'rsvp' } });

			await startInviteWorkers(h.app);
			await afterBoot();

			assert.strictEqual(h.loads(), 0, 'no config should even be read');
			assert.strictEqual(connects, 0);
			assert.strictEqual(h.attendeeEvents.listenerCount('created'), 0, 'no dispatch handlers registered');
			assert.strictEqual(h.configEvents.listenerCount('patched'), 0);
		});

		it('does nothing at all without an rsvp token secret', async () => {
			const h = harness({ invites: { encryptionKey: KEY } });

			await startInviteWorkers(h.app);
			await afterBoot();

			assert.strictEqual(h.loads(), 0);
			assert.strictEqual(connects, 0);
		});

		it('does nothing at all with no invites config block', async () => {
			const h = harness({ invites: undefined });

			await startInviteWorkers(h.app);
			await afterBoot();

			assert.strictEqual(h.loads(), 0);
			assert.strictEqual(connects, 0);
		});
	});

	describe('startup', () => {
		it('registers the dispatch handlers', async () => {
			const h = harness();

			await startInviteWorkers(h.app);

			assert.strictEqual(h.attendeeEvents.listenerCount('created'), 1);
			assert.strictEqual(h.attendeeEvents.listenerCount('removed'), 1);
			assert.strictEqual(h.meetingEvents.listenerCount('created'), 1);
			assert.strictEqual(h.meetingEvents.listenerCount('patched'), 1);
		});

		it('subscribes to config changes', async () => {
			const h = harness();

			await startInviteWorkers(h.app);

			assert.strictEqual(h.configEvents.listenerCount('created'), 1);
			assert.strictEqual(h.configEvents.listenerCount('patched'), 1);
			assert.strictEqual(h.configEvents.listenerCount('removed'), 1);
		});

		it('reads the configs once and starts a poller for the mailbox', async () => {
			const h = harness();

			await startInviteWorkers(h.app);
			assert.strictEqual(h.loads(), 1, 'senders and pollers must share one snapshot');

			await afterBoot();
			assert.strictEqual(connects, 1);
		});
	});

	describe('reacting to config changes', () => {
		for (const event of [ 'created', 'patched', 'removed' ]) {
			it(`re-reads every config on ${event}`, async () => {
				const h = harness();

				await startInviteWorkers(h.app);
				const before = h.loads();

				h.configEvents.emit(event, cfg());
				await sleep(20);

				assert.strictEqual(h.loads(), before + 1);
			});
		}

		it('picks up a mailbox that a change added', async () => {
			const h = harness({ configs: [] });

			await startInviteWorkers(h.app);
			await afterBoot();
			assert.strictEqual(connects, 0);

			h.setConfigs([ cfg() ]);
			h.configEvents.emit('created', cfg());
			await afterBoot();

			assert.strictEqual(connects, 1);
		});

		it('drops a mailbox that a change removed', async () => {
			const h = harness();

			await startInviteWorkers(h.app);
			await afterBoot();
			assert.strictEqual(connects, 1);

			h.setConfigs([]);
			h.configEvents.emit('removed', cfg());
			await afterBoot();

			assert.strictEqual(connects, 1, 'the removed mailbox must stop being polled');
		});
	});

	describe('a failing reconcile', () => {
		it('does not become an unhandled rejection', async () => {
			const h = harness();

			await startInviteWorkers(h.app);

			const unhandled: unknown[] = [];
			const onUnhandled = (err: unknown): void => { unhandled.push(err); };

			process.on('unhandledRejection', onUnhandled);
			try {
				h.failNextLoad();
				h.configEvents.emit('patched', cfg());
				await sleep(50);
			} finally {
				process.off('unhandledRejection', onUnhandled);
			}

			assert.deepStrictEqual(unhandled, [], 'a config read failure must not reach the process');
		});

		it('keeps reacting to later changes', async () => {
			const h = harness();

			await startInviteWorkers(h.app);
			h.failNextLoad();
			h.configEvents.emit('patched', cfg());
			await sleep(30);

			const before = h.loads();

			h.configEvents.emit('patched', cfg());
			await sleep(30);

			assert.strictEqual(h.loads(), before + 1);
		});
	});

	describe('shutdown', () => {
		it('stops polling', async () => {
			const h = harness();

			await startInviteWorkers(h.app);
			await afterBoot();

			stopInviteWorkers();
			const seen = connects;

			await afterBoot();

			assert.strictEqual(connects, seen);
		});
	});
});
