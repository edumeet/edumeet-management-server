import assert from 'assert';

import { isMeetingOver } from '../../src/invites/meetingWindow';

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

	it('an open-ended series is never over', () => {
		assert.strictEqual(isMeetingOver({ startsAt: now - (365 * DAY), endsAt: now - (365 * DAY) + HOUR, rrule: 'FREQ=WEEKLY;INTERVAL=1' }, now), false);
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
