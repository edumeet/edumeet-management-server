import { rrulestr } from 'rrule';
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

// More occurrences than a daily meeting has in 25 years.
const MAX_OCCURRENCES = 10000;

export const isMeetingOver = (meeting: MeetingWindow, now: number): boolean => {
	const startsAt = Number(meeting.startsAt);
	const endsAt = Number(meeting.endsAt);

	if (!meeting.rrule) return endsAt < now;

	const tz = usableZone(meeting.timezone);
	const duration = Math.max(0, endsAt - startsAt);

	try {
		const rule = rrulestr(meeting.rrule, { dtstart: asFloating(startsAt, tz) });
		const nowFloating = asFloating(now, tz).getTime();
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
