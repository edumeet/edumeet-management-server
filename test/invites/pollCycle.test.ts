import assert from 'assert';

import { encrypt } from '../../src/invites/crypto';
import { pollOnce, desiredMailboxes } from '../../src/invites/replyPoller';
import type { Application } from '../../src/declarations';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { logger } from '../../src/logger';

const KEY = 'a1'.repeat(32);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const imapModule = require('imapflow');
const realImapFlow = imapModule.ImapFlow;

interface Message { uid: number; source: string | null; envelope?: { date?: Date } }

// records the order of IMAP operations so the test can prove STORE runs after the FETCH
// iterator drains, which is the ordering some servers hang on if violated
interface Trace {
	ops: string[];
	flagged: number[][];
	deleted: number[][];
	searches: Array<Record<string, unknown>>;
	fetchQuery: Record<string, unknown> | undefined;
	locksReleased: number;
	loggedOut: number;
	constructed: Array<Record<string, unknown>>;
}

const installImap = (messages: Message[], opts: {
	connectError?: Error;
	flagError?: Error;
	searchError?: Error;
	oldUids?: number[];
} = {}): Trace => {
	const trace: Trace = {
		ops: [],
		flagged: [],
		deleted: [],
		searches: [],
		fetchQuery: undefined,
		locksReleased: 0,
		loggedOut: 0,
		constructed: []
	};

	imapModule.ImapFlow = class {
		constructor(options: Record<string, unknown>) { trace.constructed.push(options); }
		on(): void { /* noop */ }
		async connect(): Promise<void> {
			if (opts.connectError) throw opts.connectError;
			trace.ops.push('connect');
		}
		async getMailboxLock(): Promise<{ release: () => void }> {
			trace.ops.push('lock');

			return { release: () => { trace.locksReleased++; trace.ops.push('release'); } };
		}
		fetch(query: Record<string, unknown>): AsyncGenerator<Message> {
			trace.fetchQuery = query;

			return (async function *gen() {
				for (const msg of messages) {
					trace.ops.push(`fetch:${msg.uid}`);
					yield msg;
				}
			})();
		}
		async messageFlagsAdd(uids: number[]): Promise<void> {
			if (opts.flagError) throw opts.flagError;
			trace.ops.push('flag');
			trace.flagged.push(uids);
		}
		async search(query: Record<string, unknown>): Promise<number[]> {
			trace.ops.push('search');
			trace.searches.push(query);
			if (opts.searchError) throw opts.searchError;

			return opts.oldUids ?? [];
		}
		async messageDelete(uids: number[]): Promise<void> {
			trace.ops.push('delete');
			trace.deleted.push(uids);
		}
		async logout(): Promise<void> { trace.loggedOut++; trace.ops.push('logout'); }
	};

	return trace;
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
	imapHost: 'imap.example.com',
	imapPort: 993,
	imapSecure: true,
	imapUser: 'invitation@example.com',
	imapPass: encrypt('secret', KEY),
	createdAt: 0,
	updatedAt: 0,
	...over
} as unknown as TenantInviteConfig);

const replyMessage = (uid: number, meetingUid: string, sentAt = new Date()): Message => ({
	uid,
	envelope: { date: sentAt },
	source: [
		'From: guest@example.org',
		'Content-Type: text/calendar; method=REPLY',
		'Content-Transfer-Encoding: 7bit',
		'',
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'METHOD:REPLY',
		'BEGIN:VEVENT',
		`UID:${meetingUid}`,
		'SEQUENCE:1',
		'DTSTAMP:20260910T090000Z',
		'ATTENDEE;PARTSTAT=ACCEPTED:mailto:guest@example.org',
		'END:VEVENT',
		'END:VCALENDAR',
		''
	].join('\r\n')
});

const plainMessage = (uid: number): Message => ({
	uid,
	source: 'From: someone@example.org\r\nSubject: hello\r\n\r\nnot a calendar message\r\n'
});

// meetings whose uid is 'boom' make processing throw, standing in for a DB blip
const app = (retentionDays?: number): Application => ({
	get: (k: string) => {
		if (k === 'invites') {
			return retentionDays === undefined
				? { encryptionKey: KEY }
				: { encryptionKey: KEY, imapRetentionDays: retentionDays };
		}

		return undefined;
	},
	service: (name: string) => {
		if (name === 'meetings') {
			return {
				find: async (params: { query: { uid: string } }) => {
					if (params.query.uid === 'boom') throw new Error('database is down');
					if (params.query.uid === 'not-ours') return [];

					return [ { id: 11 } ];
				}
			};
		}
		if (name === 'meetingAttendees') {
			return {
				find: async () => [ { id: 22, meetingId: 11, email: 'guest@example.org' } ],
				patch: async () => ({})
			};
		}
		throw new Error(`unexpected service ${name}`);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as Application;

describe('poll cycle', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => {
		logger.transports.forEach((t) => (t.silent = false));
		imapModule.ImapFlow = realImapFlow;
	});

	it('asks only for unseen messages, with source and uid', async () => {
		const trace = installImap([]);

		await pollOnce(app(), cfg());

		assert.deepStrictEqual(trace.fetchQuery, { seen: false });
	});

	it('connects with the configured host, port and TLS setting', async () => {
		const trace = installImap([]);

		await pollOnce(app(), cfg({ imapHost: 'mail.example.net', imapPort: 143, imapSecure: false }));

		assert.strictEqual(trace.constructed[0].host, 'mail.example.net');
		assert.strictEqual(trace.constructed[0].port, 143);
		assert.strictEqual(trace.constructed[0].secure, false);
		assert.strictEqual((trace.constructed[0].auth as { pass: string }).pass, 'secret');
	});

	it('defaults the port to 993 and TLS to on', async () => {
		const trace = installImap([]);

		await pollOnce(app(), cfg({ imapPort: undefined, imapSecure: undefined }));

		assert.strictEqual(trace.constructed[0].port, 993);
		assert.strictEqual(trace.constructed[0].secure, true);
	});

	describe('marking processed mail', () => {
		it('flags a processed reply', async () => {
			const trace = installImap([ replyMessage(7, 'uid-1@meet.example.edu') ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [ [ 7 ] ]);
		});

		it('issues one STORE only after the fetch iterator has drained', async () => {
			const trace = installImap([
				replyMessage(1, 'uid-1@meet.example.edu'),
				replyMessage(2, 'uid-1@meet.example.edu'),
				replyMessage(3, 'uid-1@meet.example.edu')
			]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [ [ 1, 2, 3 ] ], 'one batched STORE, not one per message');

			const lastFetch = trace.ops.lastIndexOf('fetch:3');
			const flag = trace.ops.indexOf('flag');

			assert.ok(flag > lastFetch, `STORE inside FETCH hangs some servers: ${trace.ops.join(',')}`);
		});

		it('leaves a message with no calendar part unread', async () => {
			const trace = installImap([ plainMessage(9) ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [], 'unrelated mail must not be consumed');
		});

		it('leaves a reply for an unknown attendee mailbox alone but still consumes it', async () => {
			const trace = installImap([ replyMessage(5, 'uid-1@meet.example.edu') ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [ [ 5 ] ]);
		});

		it('keeps processing the batch when one message throws, and leaves that one unread', async () => {
			const trace = installImap([
				replyMessage(1, 'uid-1@meet.example.edu'),
				replyMessage(2, 'boom'),
				replyMessage(3, 'uid-1@meet.example.edu')
			]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(
				trace.flagged,
				[ [ 1, 3 ] ],
				'a poison message must not cost the whole batch its progress'
			);
		});

		it('survives a failed STORE without throwing', async () => {
			const trace = installImap([ replyMessage(1, 'uid-1@meet.example.edu') ], { flagError: new Error('NO') });

			await pollOnce(app(), cfg());

			assert.strictEqual(trace.loggedOut, 1);
		});
	});

	// Independent deployments can share one invite mailbox. Each holds only its own meetings,
	// so consuming a reply it does not recognise would silently lose that RSVP for the sibling
	// that does. \Seen is mailbox-wide state, which is why this matters.
	describe('a mailbox shared with another deployment', () => {
		it('leaves a reply for a meeting it does not have unread', async () => {
			const trace = installImap([ replyMessage(1, 'not-ours') ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [], 'consuming it would lose the sibling deployment its RSVP');
		});

		it('consumes only the replies it recognises out of a mixed batch', async () => {
			const trace = installImap([
				replyMessage(1, 'uid-1@meet.example.edu'),
				replyMessage(2, 'not-ours'),
				replyMessage(3, 'uid-1@meet.example.edu')
			]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [ [ 1, 3 ] ]);
		});

		it('gives up on an unclaimed reply once it is older than the window', async () => {
			const old = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000));
			const trace = installImap([ replyMessage(1, 'not-ours', old) ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [ [ 1 ] ], 'nobody is coming for it, so let retention purge it');
		});

		it('keeps waiting while an unclaimed reply is still recent', async () => {
			const recent = new Date(Date.now() - (60 * 60 * 1000));
			const trace = installImap([ replyMessage(1, 'not-ours', recent) ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, []);
		});

		it('waits rather than guessing when the message has no usable date', async () => {
			const msg = replyMessage(1, 'not-ours');

			msg.envelope = {};
			const trace = installImap([ msg ]);

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, [], 'never consume what cannot be shown to be abandoned');
		});
	});

	describe('retention cleanup', () => {
		it('purges seen mail older than the window', async () => {
			const trace = installImap([], { oldUids: [ 4, 5 ] });

			await pollOnce(app(30), cfg());

			assert.deepStrictEqual(trace.deleted, [ [ 4, 5 ] ]);
			assert.strictEqual(trace.searches[0].seen, true, 'only mail we already processed may be purged');
			assert.ok(trace.searches[0].before instanceof Date);
		});

		it('does not delete when nothing is old enough', async () => {
			const trace = installImap([], { oldUids: [] });

			await pollOnce(app(30), cfg());

			assert.deepStrictEqual(trace.deleted, []);
		});

		it('is disabled by a negative retention', async () => {
			const trace = installImap([], { oldUids: [ 4 ] });

			await pollOnce(app(-1), cfg());

			assert.deepStrictEqual(trace.searches, [], 'a negative retention must not even search');
			assert.deepStrictEqual(trace.deleted, []);
		});

		it('defaults to a 30 day window when unset', async () => {
			const trace = installImap([], { oldUids: [] });

			await pollOnce(app(), cfg());

			const before = trace.searches[0].before as Date;
			const days = (Date.now() - before.getTime()) / (24 * 60 * 60 * 1000);

			assert.ok(days > 29.9 && days < 30.1, `expected a 30 day cutoff, got ${days}`);
		});

		it('survives a failed purge without throwing', async () => {
			const trace = installImap([], { searchError: new Error('NO') });

			await pollOnce(app(30), cfg());

			assert.strictEqual(trace.loggedOut, 1);
		});
	});

	describe('teardown and guards', () => {
		it('releases the mailbox lock and logs out', async () => {
			const trace = installImap([ replyMessage(1, 'uid-1@meet.example.edu') ]);

			await pollOnce(app(), cfg());

			assert.strictEqual(trace.locksReleased, 1);
			assert.strictEqual(trace.loggedOut, 1);
			assert.ok(trace.ops.indexOf('release') < trace.ops.indexOf('logout'));
		});

		it('releases the lock even when the cycle fails midway', async () => {
			const trace = installImap([], { searchError: new Error('boom') });

			await pollOnce(app(30), cfg());

			assert.strictEqual(trace.locksReleased, 1);
		});

		it('does not throw when the connection fails', async () => {
			const trace = installImap([], { connectError: new Error('ETIMEDOUT') });

			await pollOnce(app(), cfg());

			assert.deepStrictEqual(trace.flagged, []);
		});

		it('never connects with no imap host', async () => {
			const trace = installImap([]);

			await pollOnce(app(), cfg({ imapHost: undefined }));

			assert.deepStrictEqual(trace.constructed, []);
		});

		it('never connects with incomplete credentials', async () => {
			const noUser = installImap([]);

			await pollOnce(app(), cfg({ imapUser: undefined }));
			assert.deepStrictEqual(noUser.constructed, []);

			const noPass = installImap([]);

			await pollOnce(app(), cfg({ imapPass: undefined }));
			assert.deepStrictEqual(noPass.constructed, []);
		});

		it('never connects without a server encryption key', async () => {
			const trace = installImap([]);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const keyless = { get: () => undefined, service: () => ({}) } as any as Application;

			await pollOnce(keyless, cfg());

			assert.deepStrictEqual(trace.constructed, []);
		});
	});

	describe('mailbox deduplication', () => {
		const mailbox = (over: Partial<TenantInviteConfig>) => cfg(over);

		it('collapses tenants sharing one mailbox into a single poller', () => {
			const desired = desiredMailboxes([
				mailbox({ id: 1, tenantId: 1 }),
				mailbox({ id: 2, tenantId: 2 }),
				mailbox({ id: 3, tenantId: 3 })
			]);

			assert.strictEqual(desired.size, 1, 'racing pollers on one inbox consume each others replies');
		});

		it('keeps the first enabled config as the representative', () => {
			const desired = desiredMailboxes([
				mailbox({ id: 1, tenantId: 7 }),
				mailbox({ id: 2, tenantId: 8 })
			]);

			assert.strictEqual([ ...desired.values() ][0].tenantId, 7);
		});

		it('separates different hosts, ports and users', () => {
			const desired = desiredMailboxes([
				mailbox({ id: 1 }),
				mailbox({ id: 2, imapHost: 'other.example.com' }),
				mailbox({ id: 3, imapPort: 143 }),
				mailbox({ id: 4, imapUser: 'other@example.com' })
			]);

			assert.strictEqual(desired.size, 4);
		});

		it('treats an unset port as 993, so it shares with an explicit 993', () => {
			const desired = desiredMailboxes([
				mailbox({ id: 1, imapPort: 993 }),
				mailbox({ id: 2, imapPort: undefined })
			]);

			assert.strictEqual(desired.size, 1);
		});

		it('skips disabled configs and incomplete credentials', () => {
			const desired = desiredMailboxes([
				mailbox({ id: 1, enabled: false }),
				mailbox({ id: 2, imapHost: undefined, imapUser: 'a@b.c' }),
				mailbox({ id: 3, imapHost: 'h1.example.com', imapUser: undefined }),
				mailbox({ id: 4, imapHost: 'h2.example.com', imapPass: undefined })
			]);

			assert.strictEqual(desired.size, 0);
		});

		it('falls through to the next tenant when the first is disabled', () => {
			const desired = desiredMailboxes([
				mailbox({ id: 1, tenantId: 1, enabled: false }),
				mailbox({ id: 2, tenantId: 2 })
			]);

			assert.strictEqual(desired.size, 1);
			assert.strictEqual([ ...desired.values() ][0].tenantId, 2);
		});
	});
});
