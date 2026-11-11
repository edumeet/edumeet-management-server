import assert from 'assert';
import { createSendQueue } from '../../src/invites/dispatcher';
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
