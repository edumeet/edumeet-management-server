import assert from 'assert';
import { createSendQueue, INVITE_SEND_CONCURRENCY, sendQueueCount, sendThroughMailbox } from '../../src/invites/dispatcher';
import { limitAttendeesPerMeeting } from '../../src/hooks/limitAttendeesPerMeeting';
import type { HookContext } from '../../src/declarations';

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('invite send queue', () => {
	it('never runs more than its concurrency, however many are queued', async () => {
		const queue = createSendQueue(3);
		let running = 0;
		let peak = 0;
		const release: Array<() => void> = [];
		const task = () => new Promise<void>((resolve) => {
			running++;
			peak = Math.max(peak, running);
			release.push(() => {
				running--;
				resolve();
			});
		});
		const all = Promise.all(Array.from({ length: 50 }, () => queue.run(task)));

		const state = { done: false };

		void all.then(() => {
			state.done = true;
		});

		while (!state.done) {
			await tick();
			assert.ok(running <= 3);
			// A newcomer arrives each time a slot frees: it must wait its turn, not slip in.
			void queue.run(task);
			release.shift()?.();
		}

		// Let the newcomers finish too.
		while (release.length > 0) {
			release.shift()?.();
			await tick();
		}

		assert.strictEqual(peak, 3);
	});

	it('frees the slot of a task that fails', async () => {
		const queue = createSendQueue(1);

		await assert.rejects(queue.run(async () => {
			throw new Error('smtp down');
		}));
		assert.strictEqual(await queue.run(async () => 'next'), 'next');
	});
});

describe('invite send queues per mailbox', () => {
	const mailbox = (smtpHost: string) => ({ smtpHost, smtpPort: 587, smtpUser: 'invites' });

	it('a mailbox that cannot be reached does not hold back another one', async () => {
		const stuck: Array<() => void> = [];
		const hanging = Array.from({ length: INVITE_SEND_CONCURRENCY * 3 }, () =>
			sendThroughMailbox(mailbox('down.example'), () => new Promise<void>((resolve) => stuck.push(resolve))));

		assert.strictEqual(await sendThroughMailbox(mailbox('up.example'), async () => 'sent'), 'sent');
		assert.strictEqual(stuck.length, INVITE_SEND_CONCURRENCY);

		while (stuck.length > 0) {
			stuck.shift()?.();
			await tick();
		}

		await Promise.all(hanging);
	});

	it('tenants on one mailbox share its limit, and an idle queue is dropped', async () => {
		let running = 0;
		let peak = 0;
		const release: Array<() => void> = [];
		const task = () => new Promise<void>((resolve) => {
			running++;
			peak = Math.max(peak, running);
			release.push(() => {
				running--;
				resolve();
			});
		});
		const before = sendQueueCount();
		const all = Promise.all(Array.from({ length: 10 }, () => sendThroughMailbox(mailbox('shared.example'), task)));

		assert.strictEqual(sendQueueCount(), before + 1);

		while (release.length > 0) {
			release.shift()?.();
			await tick();
		}

		await all;
		assert.strictEqual(peak, INVITE_SEND_CONCURRENCY);
		assert.strictEqual(sendQueueCount(), before);
	});
});

describe('attendees per meeting', () => {
	const context = (existing: number, data: unknown, max?: number) => ({
		data,
		app: {
			get: (key: string) => (key === 'invites'
				? { maxAttendeesPerMeeting: max }
				: () => ({ where: () => ({ count: async () => [ { total: String(existing) } ] }) }))
		}
	}) as unknown as HookContext;

	it('allows adding up to the limit', async () => {
		await limitAttendeesPerMeeting(context(1, { meetingId: 5 }, 2));
		await limitAttendeesPerMeeting(context(0, [ { meetingId: 5 }, { meetingId: 5 } ], 2));
	});

	it('refuses beyond it, also in one batch', async () => {
		await assert.rejects(limitAttendeesPerMeeting(context(2, { meetingId: 5 }, 2)), /at most 2 attendees/);
		await assert.rejects(limitAttendeesPerMeeting(context(1, [ { meetingId: 5 }, { meetingId: 5 } ], 2)), /at most 2/);
	});

	it('defaults to 300', async () => {
		await limitAttendeesPerMeeting(context(299, { meetingId: 5 }));
		await assert.rejects(limitAttendeesPerMeeting(context(300, { meetingId: 5 })), /at most 300/);
	});
});
