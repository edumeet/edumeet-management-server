import assert from 'assert';

import { isMeetingOver, meetingTokenWindow } from '../../src/invites/meetingWindow';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 8, 11, 12, 0, 0);

const oneOff = (startOffset: number) => ({ startsAt: now + startOffset, endsAt: now + startOffset + HOUR });

describe('isMeetingOver', () => {
	it('a one-off meeting is over once its end has passed', () => {
		assert.strictEqual(isMeetingOver(oneOff(-(2 * HOUR)), now), true);
		assert.strictEqual(isMeetingOver(oneOff(-(HOUR / 2)), now), false, 'still running');
		assert.strictEqual(isMeetingOver(oneOff(DAY), now), false);
	});

	it('reads the bigint strings Postgres returns', () => {
		assert.strictEqual(isMeetingOver({ startsAt: String(now - (2 * HOUR)), endsAt: String(now - HOUR) }, now), true);
		assert.strictEqual(isMeetingOver({ startsAt: String(now + HOUR), endsAt: String(now + (2 * HOUR)) }, now), false);
	});

	it('a series with a count is over only after its last occurrence has ended', () => {
		const weekly = { startsAt: now - (3 * 7 * DAY), endsAt: now - (3 * 7 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3' };

		assert.strictEqual(isMeetingOver(weekly, now), true, 'three occurrences, the last one a week ago');
		assert.strictEqual(isMeetingOver({ ...weekly, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=4' }, now), false, 'fourth occurrence is today');
		assert.strictEqual(isMeetingOver({ ...weekly, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=10' }, now), false);
	});

	it('an occurrence that is running right now keeps the series alive', () => {
		const running = { startsAt: now - (7 * DAY) - (HOUR / 2), endsAt: now - (7 * DAY) + (HOUR / 2), rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=2' };

		assert.strictEqual(isMeetingOver(running, now), false);
		assert.strictEqual(isMeetingOver(running, now + HOUR), true);
	});

	it('counts a series without an end, stored before that was refused, as a single meeting', () => {
		assert.strictEqual(isMeetingOver({ startsAt: now - (365 * DAY), endsAt: now - (365 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1' }, now), true);
	});

	it('falls back to the end date when the rule cannot be parsed', () => {
		assert.strictEqual(isMeetingOver({ ...oneOff(-(2 * HOUR)), rrule: 'FREQ=NEVERMIND' }, now), true);
		assert.strictEqual(isMeetingOver({ ...oneOff(DAY), rrule: 'FREQ=NEVERMIND' }, now), false);
	});

	it('expands a series in the meeting zone, so a DST change does not move its last occurrence', () => {
		// Weekly at 12:00 Warsaw from 5 Oct 2026 (CEST, 10:00Z), four times: the last one falls on
		// 26 Oct, after the clocks went back, so it starts at 11:00Z and ends at 12:00Z.
		const series = {
			startsAt: Date.UTC(2026, 9, 5, 10, 0, 0),
			endsAt: Date.UTC(2026, 9, 5, 11, 0, 0),
			rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=4',
			timezone: 'Europe/Warsaw'
		};

		assert.strictEqual(isMeetingOver(series, Date.UTC(2026, 9, 26, 11, 30, 0)), false, 'last occurrence still running at 12:30 local');
		assert.strictEqual(isMeetingOver(series, Date.UTC(2026, 9, 26, 12, 1, 0)), true, 'over one minute after 13:00 local');
		assert.strictEqual(isMeetingOver({ ...series, timezone: 'UTC' }, Date.UTC(2026, 9, 26, 11, 30, 0)), true, 'read as UTC it would already be over, which is the drift the zone avoids');
	});

	it('treats a missing or unknown zone as UTC rather than failing', () => {
		const series = { startsAt: now - (7 * DAY), endsAt: now - (7 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=2' };

		assert.strictEqual(isMeetingOver({ ...series, timezone: null }, now + (2 * HOUR)), true);
		assert.strictEqual(isMeetingOver({ ...series, timezone: null }, now + (HOUR / 2)), false);
		assert.strictEqual(isMeetingOver({ ...series, timezone: 'Mars/Olympus' }, now + (2 * HOUR)), true);
		assert.strictEqual(isMeetingOver({ ...series, timezone: 'Mars/Olympus' }, now + (HOUR / 2)), false);
	});
});

describe('isMeetingOver on rules with very many occurrences', () => {
	// Stored before the schema refused them: one occurrence per second since 1970, and
	// the same through BY* lists on a daily rule.
	for (const rrule of [ 'FREQ=SECONDLY', 'FREQ=DAILY;BYHOUR=0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23;BYMINUTE=0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59' ]) {
		it(`returns quickly for ${rrule.slice(0, 40)}`, () => {
			const started = Date.now();

			assert.strictEqual(isMeetingOver({ startsAt: 0, endsAt: 1000, rrule }, now), true);
			assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
		});
	}

	it('still finds the next occurrence of a daily meeting from years ago', () => {
		const start = now - (20 * 365 * DAY) - HOUR;

		assert.strictEqual(isMeetingOver({ startsAt: start, endsAt: start + (2 * HOUR), rrule: 'FREQ=DAILY;INTERVAL=1;UNTIL=20991231' }, now), false);
	});

	it('returns quickly for a rule that never matches', () => {
		const started = Date.now();
		const start = now - (365 * DAY);

		assert.strictEqual(isMeetingOver({ startsAt: start, endsAt: start + HOUR, rrule: 'FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30' }, now), true);
		assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
	});

	it('returns quickly for a stored daily weekday rule whose interval stays on a weekday it leaves out', () => {
		const started = Date.now();
		const monday = Date.UTC(2026, 10, 9, 10);

		assert.strictEqual(isMeetingOver({ startsAt: monday, endsAt: monday + HOUR, rrule: 'FREQ=DAILY;INTERVAL=7;BYDAY=TU;COUNT=5', timezone: 'Europe/Oslo' }, Date.UTC(2026, 10, 10)), true);
		assert.ok(Date.now() - started < 100, `took ${Date.now() - started} ms`);
	});

	it('treats a stored rule or start the schema refuses as a single meeting', () => {
		assert.strictEqual(isMeetingOver({ startsAt: now - HOUR, endsAt: now + HOUR, rrule: 'FREQ=SECONDLY' }, now), false, 'still running');
		assert.strictEqual(isMeetingOver({ startsAt: now - (2 * HOUR), endsAt: now - HOUR, rrule: 'FREQ=DAILY\r\nX:Y' }, now), true);
		assert.strictEqual(isMeetingOver({ startsAt: -1e12, endsAt: -1e12 + HOUR, rrule: 'FREQ=DAILY' }, now), true);
	});
});

describe('meetingTokenWindow', () => {
	const MIN = 60_000;

	it('opens a one-off meeting from an hour before its start until an hour after its end', () => {
		const meeting = oneOff(3 * HOUR);

		assert.deepStrictEqual(meetingTokenWindow(meeting, now), { state: 'early', startsAt: now + (3 * HOUR), endsAt: now + (4 * HOUR) });
		assert.strictEqual(meetingTokenWindow(meeting, now + (2 * HOUR) + MIN).state, 'open', '59 minutes before the start');
		assert.strictEqual(meetingTokenWindow(meeting, now + (3.5 * HOUR)).state, 'open', 'running');
		assert.strictEqual(meetingTokenWindow(meeting, now + (5 * HOUR) - MIN).state, 'open', '59 minutes after the end');
		assert.deepStrictEqual(meetingTokenWindow(meeting, now + (5 * HOUR) + MIN), { state: 'over', startsAt: now + (3 * HOUR), endsAt: now + (4 * HOUR) });
	});

	it('reads the bigint strings Postgres returns', () => {
		assert.strictEqual(meetingTokenWindow({ startsAt: String(now + (3 * HOUR)), endsAt: String(now + (4 * HOUR)) }, now).state, 'early');
	});

	it('between the occurrences of a series it gives the next one', () => {
		const weekly = { startsAt: now - (3 * DAY), endsAt: now - (3 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=5' };

		assert.deepStrictEqual(meetingTokenWindow(weekly, now), { state: 'early', startsAt: now + (4 * DAY), endsAt: now + (4 * DAY) + HOUR });
	});

	it('opens an occurrence of a series an hour before it starts', () => {
		const weekly = { startsAt: now - (7 * DAY) + (HOUR / 2), endsAt: now - (7 * DAY) + (1.5 * HOUR), rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3' };

		assert.deepStrictEqual(meetingTokenWindow(weekly, now), { state: 'open', startsAt: now + (HOUR / 2), endsAt: now + (1.5 * HOUR) });
	});

	it('after the last occurrence of a series it gives that occurrence as over', () => {
		const weekly = { startsAt: now - (3 * 7 * DAY), endsAt: now - (3 * 7 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3' };

		assert.deepStrictEqual(meetingTokenWindow(weekly, now), { state: 'over', startsAt: now - (7 * DAY), endsAt: now - (7 * DAY) + HOUR });
	});

	it('keeps an occurrence at its local time across a DST change', () => {
		// Weekly at 12:00 Warsaw from 5 Oct 2026 (CEST, 10:00Z): on 26 Oct, after the clocks went
		// back, the occurrence starts at 11:00Z.
		const series = {
			startsAt: Date.UTC(2026, 9, 5, 10, 0, 0),
			endsAt: Date.UTC(2026, 9, 5, 11, 0, 0),
			rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=4',
			timezone: 'Europe/Warsaw'
		};

		assert.deepStrictEqual(meetingTokenWindow(series, Date.UTC(2026, 9, 26, 10, 30, 0)),
			{ state: 'open', startsAt: Date.UTC(2026, 9, 26, 11, 0, 0), endsAt: Date.UTC(2026, 9, 26, 12, 0, 0) });
	});

	it('keeps a token open for a series stored before the rules, as before the window', () => {
		assert.strictEqual(meetingTokenWindow({ startsAt: now - (365 * DAY), endsAt: now - (365 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1' }, now).state, 'open');
		assert.strictEqual(meetingTokenWindow({ ...oneOff(3 * HOUR), rrule: 'FREQ=NEVERMIND' }, now).state, 'open');
	});

	it('still closes a single meeting without a rule', () => {
		assert.strictEqual(meetingTokenWindow({ ...oneOff(-(3 * HOUR)), rrule: null }, now).state, 'over');
	});

	describe('with the room\'s last activity', () => {
		const meeting = oneOff(0);
		const end = now + HOUR;

		it('counts the hour from when the room emptied after a meeting that ran over', () => {
			const ranOver = { ...meeting, lastActiveAt: end + (40 * MIN) };

			assert.strictEqual(meetingTokenWindow(ranOver, end + (99 * MIN)).state, 'open', '59 minutes after the room emptied');
			assert.deepStrictEqual(meetingTokenWindow(ranOver, end + (101 * MIN)), { state: 'over', startsAt: now, endsAt: end + (40 * MIN) });
		});

		it('keeps the token until an hour after the scheduled end when everyone left early', () => {
			const leftEarly = { ...meeting, lastActiveAt: now + (20 * MIN) };

			assert.strictEqual(meetingTokenWindow(leftEarly, end + (59 * MIN)).state, 'open');
			assert.deepStrictEqual(meetingTokenWindow(leftEarly, end + (61 * MIN)), { state: 'over', startsAt: now, endsAt: end });
		});

		it('starts the hour again when someone came back during it', () => {
			// Emptied at 13:30, back at 14:20 and gone at 14:25: the token now lasts until 15:25.
			const cameBack = { ...meeting, lastActiveAt: end + (85 * MIN) };

			assert.strictEqual(meetingTokenWindow(cameBack, end + (140 * MIN)).state, 'open');
			assert.deepStrictEqual(meetingTokenWindow(cameBack, end + (146 * MIN)), { state: 'over', startsAt: now, endsAt: end + (85 * MIN) });
		});

		it('ignores activity from before the meeting opened, as from an earlier date of a moved meeting', () => {
			const moved = { ...meeting, lastActiveAt: now - (2 * HOUR) };

			assert.deepStrictEqual(meetingTokenWindow(moved, end + (61 * MIN)), { state: 'over', startsAt: now, endsAt: end });
			assert.strictEqual(meetingTokenWindow({ ...meeting, lastActiveAt: now - HOUR }, end + (61 * MIN)).state, 'over', 'opening time, before the scheduled end');
		});

		it('does not open a meeting early because of activity', () => {
			assert.strictEqual(meetingTokenWindow({ ...oneOff(3 * HOUR), lastActiveAt: now }, now).state, 'early');
		});

		it('reads bigint strings and treats null as no activity', () => {
			assert.strictEqual(meetingTokenWindow({ ...meeting, lastActiveAt: String(end + (40 * MIN)) }, end + (99 * MIN)).state, 'open');
			assert.strictEqual(meetingTokenWindow({ ...meeting, lastActiveAt: null }, end + (61 * MIN)).state, 'over');
			assert.strictEqual(meetingTokenWindow({ ...meeting, lastActiveAt: 'garbage' }, end + (61 * MIN)).state, 'over');
		});

		it('keeps the occurrence of a series that ran over open before giving the next one', () => {
			// Today's occurrence ended two hours ago; its room emptied 30 minutes ago.
			const weekly = { startsAt: now - (7 * DAY) - (3 * HOUR), endsAt: now - (7 * DAY) - (2 * HOUR), rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=5' };

			assert.deepStrictEqual(meetingTokenWindow({ ...weekly, lastActiveAt: now - (30 * MIN) }, now),
				{ state: 'open', startsAt: now - (3 * HOUR), endsAt: now - (2 * HOUR) });
			assert.deepStrictEqual(meetingTokenWindow(weekly, now),
				{ state: 'early', startsAt: now + (7 * DAY) - (3 * HOUR), endsAt: now + (7 * DAY) - (2 * HOUR) });
			assert.deepStrictEqual(meetingTokenWindow({ ...weekly, lastActiveAt: now - (30 * MIN) }, now + (31 * MIN)),
				{ state: 'early', startsAt: now + (7 * DAY) - (3 * HOUR), endsAt: now + (7 * DAY) - (2 * HOUR) }, 'the hour after it emptied has passed');
		});

		it('does not reopen the last occurrence of a series with activity from an older one', () => {
			const weekly = { startsAt: now - (14 * DAY) - (3 * HOUR), endsAt: now - (14 * DAY) - (2 * HOUR), rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3' };

			assert.deepStrictEqual(meetingTokenWindow({ ...weekly, lastActiveAt: now - (7 * DAY) }, now),
				{ state: 'over', startsAt: now - (3 * HOUR), endsAt: now - (2 * HOUR) });
			assert.deepStrictEqual(meetingTokenWindow({ ...weekly, lastActiveAt: now - (30 * MIN) }, now),
				{ state: 'open', startsAt: now - (3 * HOUR), endsAt: now - (2 * HOUR) });
			assert.deepStrictEqual(meetingTokenWindow({ ...weekly, lastActiveAt: now - (30 * MIN) }, now + (31 * MIN)),
				{ state: 'over', startsAt: now - (3 * HOUR), endsAt: now - (30 * MIN) });
		});
	});
});
