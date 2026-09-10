import assert from 'assert';

import { processReplyIcs } from '../../src/invites/replyPoller';
import type { Application } from '../../src/declarations';
import { logger } from '../../src/logger';

interface Recorded {
	attendeePatches: Array<{ id: number, data: Record<string, unknown> }>;
	rsvpCreates: Array<Record<string, unknown>>;
	rsvpPatches: Array<{ id: number, data: Record<string, unknown> }>;
}

interface Fixture {
	app: Application;
	rec: Recorded;
}

const fixture = (opts: {
	meeting?: { id: number };
	attendee?: Record<string, unknown>;
	rsvp?: Record<string, unknown>;
} = {}): Fixture => {
	const meeting = 'meeting' in opts ? opts.meeting : { id: 11 };
	const attendee = 'attendee' in opts
		? opts.attendee
		: { id: 22, meetingId: 11, email: 'guest@example.org', partstat: 'NEEDS-ACTION' };
	const rec: Recorded = { attendeePatches: [], rsvpCreates: [], rsvpPatches: [] };

	const app = {
		get: () => undefined,
		service: (name: string) => {
			if (name === 'meetings') return { find: async () => (meeting ? [ meeting ] : []) };
			if (name === 'meetingAttendees') {
				return {
					find: async () => (attendee ? [ attendee ] : []),
					patch: async (id: number, data: Record<string, unknown>) => {
						rec.attendeePatches.push({ id, data });

						return data;
					}
				};
			}
			if (name === 'meetingOccurrenceRsvps') {
				return {
					find: async () => (opts.rsvp ? [ opts.rsvp ] : []),
					create: async (data: Record<string, unknown>) => {
						rec.rsvpCreates.push(data);

						return data;
					},
					patch: async (id: number, data: Record<string, unknown>) => {
						rec.rsvpPatches.push({ id, data });

						return data;
					}
				};
			}
			throw new Error(`unexpected service ${name}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any as Application;

	return { app, rec };
};

const reply = (over: Record<string, string> = {}): string => {
	const props: Record<string, string> = {
		METHOD: 'REPLY',
		UID: 'uid-1@meet.example.edu',
		SEQUENCE: '3',
		DTSTAMP: '20260910T090000Z',
		PARTSTAT: 'ACCEPTED',
		...over
	};
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`METHOD:${props.METHOD}`,
		'BEGIN:VEVENT',
		`UID:${props.UID}`,
		`SEQUENCE:${props.SEQUENCE}`,
		`DTSTAMP:${props.DTSTAMP}`,
		'DTSTART:20260910T100000Z',
		'ORGANIZER:mailto:invitation@example.com'
	];

	if (props['RECURRENCE-ID']) lines.push(`RECURRENCE-ID:${props['RECURRENCE-ID']}`);
	lines.push(`ATTENDEE;PARTSTAT=${props.PARTSTAT}:${props.MAILTO ?? 'mailto:guest@example.org'}`);
	lines.push('END:VEVENT', 'END:VCALENDAR');

	return lines.join('\r\n');
};

describe('reply processing', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('records an accepted reply with its sequence and dtstamp', async () => {
		const f = fixture();

		const outcome = await processReplyIcs(f.app, reply());

		assert.deepStrictEqual(outcome, { isReply: true, claimed: 1, updated: 1 });
		assert.strictEqual(f.rec.attendeePatches.length, 1);
		assert.strictEqual(f.rec.attendeePatches[0].id, 22);
		assert.strictEqual(f.rec.attendeePatches[0].data.partstat, 'ACCEPTED');
		assert.strictEqual(f.rec.attendeePatches[0].data.replySequence, 3);
		assert.strictEqual(f.rec.attendeePatches[0].data.replyDtstamp, Date.UTC(2026, 8, 10, 9, 0, 0));
	});

	it('ignores anything that is not a REPLY', async () => {
		const f = fixture();

		const outcome = await processReplyIcs(f.app, reply({ METHOD: 'REQUEST' }));

		assert.strictEqual(outcome.isReply, false, 'a REQUEST must not be treated as a reply');
		assert.strictEqual(outcome.claimed, 0);
		assert.strictEqual(f.rec.attendeePatches.length, 0);
	});

	it('normalizes an unrecognized partstat to NEEDS-ACTION', async () => {
		const f = fixture();

		await processReplyIcs(f.app, reply({ PARTSTAT: 'DELEGATED' }));

		assert.strictEqual(f.rec.attendeePatches[0].data.partstat, 'NEEDS-ACTION');
	});

	it('matches the attendee regardless of MAILTO case', async () => {
		const f = fixture();

		await processReplyIcs(f.app, reply({ MAILTO: 'MAILTO:Guest@Example.org' }));

		assert.strictEqual(f.rec.attendeePatches.length, 1);
	});

	describe('out-of-order protection', () => {
		const stored = { id: 22, meetingId: 11, email: 'guest@example.org', replySequence: 5, replyDtstamp: 2000 };

		it('drops a reply with a lower sequence', async () => {
			const f = fixture({ attendee: stored });

			await processReplyIcs(f.app, reply({ SEQUENCE: '3' }));

			assert.strictEqual(f.rec.attendeePatches.length, 0, 'a late ACCEPT must not overwrite a newer DECLINE');
		});

		it('drops a reply with an equal sequence and an older dtstamp', async () => {
			const f = fixture({ attendee: { ...stored, replyDtstamp: Date.UTC(2026, 8, 10, 12, 0, 0) } });

			await processReplyIcs(f.app, reply({ SEQUENCE: '5', DTSTAMP: '20260910T090000Z' }));

			assert.strictEqual(f.rec.attendeePatches.length, 0);
		});

		it('applies a reply with an equal sequence and a newer dtstamp', async () => {
			const f = fixture({ attendee: { ...stored, replyDtstamp: Date.UTC(2026, 8, 10, 8, 0, 0) } });

			await processReplyIcs(f.app, reply({ SEQUENCE: '5', DTSTAMP: '20260910T090000Z' }));

			assert.strictEqual(f.rec.attendeePatches.length, 1);
		});

		it('applies a higher sequence even when its dtstamp is older', async () => {
			const f = fixture({ attendee: { ...stored, replySequence: 4, replyDtstamp: Date.UTC(2026, 8, 10, 12, 0, 0) } });

			await processReplyIcs(f.app, reply({ SEQUENCE: '9', DTSTAMP: '20260910T090000Z' }));

			assert.strictEqual(f.rec.attendeePatches.length, 1, 'SEQUENCE outranks DTSTAMP');
		});

		it('accepts the first reply when nothing is stored yet', async () => {
			const f = fixture({ attendee: { id: 22, meetingId: 11, email: 'guest@example.org' } });

			await processReplyIcs(f.app, reply());

			assert.strictEqual(f.rec.attendeePatches.length, 1);
		});
	});

	describe('ownership, which decides whether the message may be consumed', () => {
		it('claims a reply it applied', async () => {
			const f = fixture();
			const outcome = await processReplyIcs(f.app, reply());

			assert.strictEqual(outcome.claimed, 1);
			assert.strictEqual(outcome.updated, 1);
		});

		it('still claims a duplicate it deliberately skipped as stale', async () => {
			// nothing is written, but the reply is ours: leaving it unclaimed would make the
			// poller reprocess it every cycle forever
			const f = fixture({
				attendee: { id: 22, meetingId: 11, email: 'guest@example.org', replySequence: 9, replyDtstamp: 5000 }
			});
			const outcome = await processReplyIcs(f.app, reply({ SEQUENCE: '3' }));

			assert.strictEqual(outcome.claimed, 1, 'a stale duplicate still belongs to this deployment');
			assert.strictEqual(outcome.updated, 0);
			assert.strictEqual(f.rec.attendeePatches.length, 0);
		});

		it('claims an occurrence reply it applied', async () => {
			const f = fixture();
			const outcome = await processReplyIcs(f.app, reply({ 'RECURRENCE-ID': '20260917T100000Z' }));

			assert.strictEqual(outcome.claimed, 1);
			assert.strictEqual(outcome.updated, 1);
		});

		it('claims nothing when the meeting belongs to another deployment', async () => {
			const f = fixture({ meeting: undefined });
			const outcome = await processReplyIcs(f.app, reply());

			assert.deepStrictEqual(outcome, { isReply: true, claimed: 0, updated: 0 });
		});

		it('claims nothing when the replier is on no guest list here', async () => {
			const f = fixture({ attendee: undefined });
			const outcome = await processReplyIcs(f.app, reply());

			assert.strictEqual(outcome.claimed, 0);
		});
	});

	describe('unmatched replies', () => {
		it('writes nothing when no meeting has that uid', async () => {
			const f = fixture({ meeting: undefined });

			await processReplyIcs(f.app, reply());

			assert.strictEqual(f.rec.attendeePatches.length, 0);
		});

		it('writes nothing when the replier is not on the guest list', async () => {
			const f = fixture({ attendee: undefined });

			await processReplyIcs(f.app, reply());

			assert.strictEqual(f.rec.attendeePatches.length, 0);
		});
	});

	describe('malformed dates', () => {
		it('never stores NaN for an unparseable DTSTAMP', async () => {
			const f = fixture();

			await processReplyIcs(f.app, reply({ DTSTAMP: 'not-a-date' }));

			assert.strictEqual(f.rec.attendeePatches.length, 1);

			const written = f.rec.attendeePatches[0].data.replyDtstamp as number;

			assert.ok(Number.isFinite(written), `replyDtstamp must be finite, got ${written}`);
		});

		it('treats an unparseable RECURRENCE-ID as a series reply, not a NaN occurrence', async () => {
			const f = fixture();

			await processReplyIcs(f.app, reply({ 'RECURRENCE-ID': 'not-a-date' }));

			assert.strictEqual(f.rec.rsvpCreates.length, 0, 'must not write an occurrence keyed by NaN');
			assert.strictEqual(f.rec.attendeePatches.length, 1);
		});
	});

	describe('per-occurrence replies', () => {
		it('resolves a TZID-qualified RECURRENCE-ID to the right instant', async () => {
			// invites now go out with TZID plus VTIMEZONE, so clients reply in the same form;
			// 12:00 Warsaw on 17 September is 10:00Z
			const f = fixture();
			const ics = reply().replace(
				'DTSTART:20260910T100000Z',
				'DTSTART;TZID=Europe/Warsaw:20260910T120000\r\nRECURRENCE-ID;TZID=Europe/Warsaw:20260917T120000'
			);

			await processReplyIcs(f.app, ics);

			assert.strictEqual(f.rec.rsvpCreates.length, 1);
			assert.strictEqual(f.rec.rsvpCreates[0].recurrenceId, Date.UTC(2026, 8, 17, 10, 0, 0));
		});

		it('creates an occurrence rsvp and leaves the series partstat alone', async () => {
			const f = fixture();

			await processReplyIcs(f.app, reply({ 'RECURRENCE-ID': '20260917T100000Z', PARTSTAT: 'DECLINED' }));

			assert.strictEqual(f.rec.attendeePatches.length, 0);
			assert.strictEqual(f.rec.rsvpCreates.length, 1);
			assert.strictEqual(f.rec.rsvpCreates[0].partstat, 'DECLINED');
			assert.strictEqual(f.rec.rsvpCreates[0].recurrenceId, Date.UTC(2026, 8, 17, 10, 0, 0));
			assert.strictEqual(f.rec.rsvpCreates[0].meetingAttendeeId, 22);
		});

		it('patches an existing occurrence rsvp', async () => {
			const f = fixture({ rsvp: { id: 33, replySequence: 1, replyDtstamp: 1000 } });

			await processReplyIcs(f.app, reply({ 'RECURRENCE-ID': '20260917T100000Z' }));

			assert.strictEqual(f.rec.rsvpPatches.length, 1);
			assert.strictEqual(f.rec.rsvpPatches[0].id, 33);
		});

		it('drops a stale occurrence reply', async () => {
			const f = fixture({ rsvp: { id: 33, replySequence: 9, replyDtstamp: 1000 } });

			await processReplyIcs(f.app, reply({ 'RECURRENCE-ID': '20260917T100000Z', SEQUENCE: '3' }));

			assert.strictEqual(f.rec.rsvpPatches.length, 0);
			assert.strictEqual(f.rec.rsvpCreates.length, 0);
		});
	});
});
