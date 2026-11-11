import { RRule, rrulestr } from 'rrule';
import { MEETING_TIME_MIN, isAllowedRrule } from './rrulePolicy';
import { TZDate } from '@date-fns/tz';

export interface MeetingWindow {
	startsAt: number | string;
	endsAt: number | string;
	rrule?: string | null;
	timezone?: string | null;
}

// rrule expands on the UTC fields of the dates it is given. Feeding it the meeting zone's wall
// clock as if it were UTC keeps every occurrence at the same local time across a DST change,
// which is what the TZID-based RRULE in the invitation promises. Same trick as the client.
const asFloating = (ms: number, tz: string): Date => {
	const d = new TZDate(ms, tz);

	return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
};

const fromFloating = (d: Date, tz: string): number =>
	new TZDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), tz).getTime();

const usableZone = (tz: string | null | undefined): string => {
	if (!tz) return 'UTC';
	try {
		return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
	} catch {
		return 'UTC';
	}
};

// More occurrences than a daily meeting has from 2000 until two years from now.
const MAX_OCCURRENCES = 20000;
// How far ahead an occurrence is looked for. A rule with none in that time is over.
const LOOKAHEAD_MS = 2 * 366 * 24 * 60 * 60 * 1000;

export const isMeetingOver = (meeting: MeetingWindow, now: number): boolean => {
	const startsAt = Number(meeting.startsAt);
	const endsAt = Number(meeting.endsAt);

	// A rule or start the meeting schema would refuse now, stored before it did, is not
	// expanded: the meeting counts as a single one.
	if (!isAllowedRrule(meeting.rrule) || startsAt < MEETING_TIME_MIN) return endsAt < now;

	const tz = usableZone(meeting.timezone);
	const duration = Math.max(0, endsAt - startsAt);

	try {
		const parsed = rrulestr(meeting.rrule, { dtstart: asFloating(startsAt, tz) });
		const nowFloating = asFloating(now, tz).getTime();
		// rrule walks every period from dtstart until it finds an occurrence; for a rule that
		// matches nothing (BYMONTH=2;BYMONTHDAY=30) it would walk to the year 9999 without
		// ever calling the iterator below. An end near now bounds that walk.
		const horizon = new Date(nowFloating + LOOKAHEAD_MS);
		const until = parsed.options.until && parsed.options.until < horizon ? parsed.options.until : horizon;
		const rule = new RRule({ ...parsed.origOptions, dtstart: parsed.options.dtstart, until });
		let last: Date | undefined;
		let upcoming = false;
		let seen = 0;

		// Walk the occurrences once, up to the first one from now on. rule.after() and
		// rule.before() also walk from dtstart, with no limit, so a rule with a start far
		// in the past and a short period would block the event loop for hours.
		rule.all((date) => {
			if (date.getTime() >= nowFloating) {
				upcoming = true;

				return false;
			}
			last = date;

			return ++seen < MAX_OCCURRENCES;
		});

		// A rule with more past occurrences than any real meeting is treated as over.
		if (upcoming) return false;
		if (seen >= MAX_OCCURRENCES) return true;
		if (!last) return endsAt < now;

		return fromFloating(last, tz) + duration < now;
	} catch {
		return endsAt < now;
	}
};
