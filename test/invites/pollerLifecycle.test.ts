import assert from 'assert';

import { encrypt } from '../../src/invites/crypto';
import { reconcilePollers, stopAllPollers, POLLER_BOOT_DELAY_MS } from '../../src/invites/replyPoller';
import type { Application } from '../../src/declarations';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { logger } from '../../src/logger';

const KEY = 'b2'.repeat(32);

// Two interval regimes. A long one means each poller polls exactly once inside the boot
// wait, so the connect count is a poller count. A short one is for observing repeats.
const ONE_SHOT_MS = 60000;
const REPEATING_MS = 30;
// the production boot settle is seconds long, which the config lets a test shorten
const BOOT_MS = 40;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const afterBoot = (extraMs = 0): Promise<void> => sleep(BOOT_MS + 120 + extraMs);

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

// startPoller reads the config once to pick the interval, so call 1 is that read and call 2
// is the first cycle. Throwing on call 2 rejects a cycle from outside pollOnce's own try,
// which is the case that used to end the poller for good.
const app = (opts: { intervalMs?: number, throwOnGetCall?: number } = {}): Application => {
	let calls = 0;

	return {
		get: (k: string) => {
			if (k !== 'invites') return undefined;
			calls++;
			if (opts.throwOnGetCall !== undefined && calls === opts.throwOnGetCall) {
				throw new Error('config read failed');
			}

			return {
				encryptionKey: KEY,
				imapPollIntervalMs: opts.intervalMs ?? ONE_SHOT_MS,
				imapPollBootDelayMs: BOOT_MS
			};
		},
		service: () => ({ find: async () => [] })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any as Application;
};

describe('poller lifecycle', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => {
		logger.transports.forEach((t) => (t.silent = false));
		imapModule.ImapFlow = realImapFlow;
	});

	beforeEach(installImap);
	afterEach(stopAllPollers);

	it('defaults the boot settle to seconds, so a restart is not a thundering herd', () => {
		assert.strictEqual(POLLER_BOOT_DELAY_MS, 5000);
	});

	it('keeps polling on an interval after a failed cycle', async () => {
		reconcilePollers(app({ intervalMs: REPEATING_MS }), [ cfg() ]);
		await afterBoot(REPEATING_MS * 4);

		assert.ok(connects >= 2, `expected repeat polls, got ${connects}`);
	}).timeout(10000);

	it('survives a cycle that rejects outright', async () => {
		reconcilePollers(app({ intervalMs: REPEATING_MS, throwOnGetCall: 2 }), [ cfg() ]);
		await afterBoot(REPEATING_MS * 6);

		assert.ok(connects >= 1, 'a rejected cycle must not end the poller, no later poll happened');
	}).timeout(10000);

	it('stops polling once torn down', async () => {
		reconcilePollers(app({ intervalMs: REPEATING_MS }), [ cfg() ]);
		await afterBoot(REPEATING_MS * 4);

		stopAllPollers();
		await sleep(50);

		const seen = connects;

		await sleep(REPEATING_MS * 6);

		assert.strictEqual(connects, seen, 'a stopped poller must not keep connecting');
	}).timeout(10000);

	it('runs one poller for tenants sharing a mailbox', async () => {
		reconcilePollers(app(), [
			cfg({ id: 1, tenantId: 1 }),
			cfg({ id: 2, tenantId: 2 }),
			cfg({ id: 3, tenantId: 3 })
		]);
		await afterBoot();

		assert.strictEqual(connects, 1, `three tenants on one inbox must not race, got ${connects} pollers`);
	}).timeout(10000);

	it('runs a poller per distinct mailbox', async () => {
		reconcilePollers(app(), [
			cfg({ id: 1, imapUser: 'one@example.com' }),
			cfg({ id: 2, imapUser: 'two@example.com' })
		]);
		await afterBoot();

		assert.strictEqual(connects, 2);
	}).timeout(10000);

	it('starts nothing when no config has usable imap settings', async () => {
		reconcilePollers(app(), [ cfg({ enabled: false }), cfg({ id: 2, imapHost: undefined }) ]);
		await afterBoot();

		assert.strictEqual(connects, 0);
	}).timeout(10000);

	it('replaces the previous poller set rather than adding to it', async () => {
		reconcilePollers(app(), [ cfg({ id: 1, imapUser: 'one@example.com' }) ]);
		reconcilePollers(app(), [ cfg({ id: 2, imapUser: 'two@example.com' }) ]);
		await afterBoot();

		assert.strictEqual(connects, 1, 'a reconcile must not leave the old poller running');
	}).timeout(10000);
});
