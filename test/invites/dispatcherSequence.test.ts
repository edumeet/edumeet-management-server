import assert from 'assert';
import { EventEmitter } from 'events';

import { registerMeetingEventHandlers, DISPATCH_DEBOUNCE_MS } from '../../src/invites/dispatcher';
import type { Application } from '../../src/declarations';
import type { MeetingAttendee } from '../../src/services/meetingAttendees/meetingAttendees.schema';
import { logger } from '../../src/logger';

// The assertions have to outwait the dispatcher's debounce, which is why they are slow.
const DEBOUNCE_WAIT_MS = DISPATCH_DEBOUNCE_MS + 300;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Harness {
	app: Application;
	attendeeEvents: EventEmitter;
	increments: number;
}

const harness = (attendees: Partial<MeetingAttendee>[]): Harness => {
	const attendeeEvents = new EventEmitter();
	const meetingEvents = new EventEmitter();
	const state = { increments: 0 };

	const knex = (table: string) => {
		assert.strictEqual(table, 'meetings');

		return {
			where: () => ({
				increment: async (column: string, by: number) => {
					assert.strictEqual(column, 'sequence');
					assert.strictEqual(by, 1);
					state.increments++;
				}
			})
		};
	};

	const app = {
		get: (k: string) => (k === 'postgresqlClient' ? knex : undefined),
		service: (name: string) => {
			if (name === 'meetingAttendees') {
				return Object.assign(attendeeEvents, { find: async () => attendees });
			}
			if (name === 'meetings') {
				return Object.assign(meetingEvents, {
					get: async () => ({ id: 1, tenantId: 1, roomId: 1, sequence: 0, status: 'CONFIRMED' })
				});
			}
			// no invite config, so runDispatch stops before sending anything
			if (name === 'tenantInviteConfigs') return { find: async () => [] };
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any as Application;

	registerMeetingEventHandlers(app);

	return {
		app,
		attendeeEvents,
		get increments() { return state.increments; }
	} as Harness;
};

describe('invites dispatcher sequence bumps', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('does not bump while nobody has been notified yet', async () => {
		const h = harness([
			{ id: 1, lastNotifiedSequence: -1 },
			{ id: 2, lastNotifiedSequence: -1 }
		]);

		h.attendeeEvents.emit('created', { id: 1, meetingId: 1 });
		h.attendeeEvents.emit('created', { id: 2, meetingId: 1 });
		await wait(DEBOUNCE_WAIT_MS);

		assert.strictEqual(h.increments, 0, 'a freshly created meeting must go out at SEQUENCE:0');
	}).timeout(10000);

	it('bumps once for a burst of four attendees on an already notified meeting', async () => {
		const h = harness([
			{ id: 1, lastNotifiedSequence: 0 },
			{ id: 2, lastNotifiedSequence: -1 },
			{ id: 3, lastNotifiedSequence: -1 },
			{ id: 4, lastNotifiedSequence: -1 }
		]);

		for (let i = 1; i <= 4; i++) h.attendeeEvents.emit('created', { id: i, meetingId: 1 });
		await wait(DEBOUNCE_WAIT_MS);

		assert.strictEqual(h.increments, 1, 'one save must advance the sequence once, not once per guest');
	}).timeout(10000);

	it('bumps again for a second, separate save', async () => {
		const h = harness([ { id: 1, lastNotifiedSequence: 0 } ]);

		h.attendeeEvents.emit('created', { id: 2, meetingId: 1 });
		await wait(DEBOUNCE_WAIT_MS);
		h.attendeeEvents.emit('created', { id: 3, meetingId: 1 });
		await wait(DEBOUNCE_WAIT_MS);

		assert.strictEqual(h.increments, 2);
	}).timeout(15000);

	it('does not bump when only the meeting itself changed', async () => {
		const h = harness([ { id: 1, lastNotifiedSequence: 0 } ]);

		// the meetings patch hook already advances the sequence; dispatch must not add to it
		h.app.service('meetings').emit('patched', { id: 1 });
		await wait(DEBOUNCE_WAIT_MS);

		assert.strictEqual(h.increments, 0);
	}).timeout(10000);
});
