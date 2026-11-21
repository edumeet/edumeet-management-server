import { RRule, rrulestr } from 'rrule';
import { MEETING_TIME_MIN, isAllowedRrule } from './rrulePolicy';
import { TZDate } from '@date-fns/tz';

export interface MeetingWindow {
	startsAt: number | string;
	endsAt: number | string;
	rrule?: string | null;
	timezone?: string | null;
	lastActiveAt?: number | string | null;
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

// rrule walks every period from dtstart until it finds an occurrence; for a rule that matches
// nothing (BYMONTH=2;BYMONTHDAY=30) it would walk to the year 9999 without ever calling the
// iterator. An end near now bounds that walk.
const boundedRule = (rrule: string, startsAt: number, tz: string, nowFloating: number): RRule => {
	const parsed = rrulestr(rrule, { dtstart: asFloating(startsAt, tz) });
	const horizon = new Date(nowFloating + LOOKAHEAD_MS);
	const until = parsed.options.until && parsed.options.until < horizon ? parsed.options.until : horizon;

	return new RRule({ ...parsed.origOptions, dtstart: parsed.options.dtstart, until });
};

export const isMeetingOver = (meeting: MeetingWindow, now: number): boolean => {
	const startsAt = Number(meeting.startsAt);
	const endsAt = Number(meeting.endsAt);

	// A rule or start the meeting schema would refuse now, stored before it did, is not
	// expanded: the meeting counts as a single one.
	if (!isAllowedRrule(meeting.rrule) || startsAt < MEETING_TIME_MIN) return endsAt < now;

	const tz = usableZone(meeting.timezone);
	const duration = Math.max(0, endsAt - startsAt);

	try {
		const nowFloating = asFloating(now, tz).getTime();
		const rule = boundedRule(meeting.rrule, startsAt, tz, nowFloating);
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

// A meeting token opens a meetings-only room from an hour before the meeting (or one of its
// occurrences) until an hour after its end. Joiners of a meeting already running are not
// checked again by the room server, so a meeting that runs over keeps its latecomers.
export const TOKEN_OPENS_BEFORE_MS = 60 * 60 * 1000;
export const TOKEN_CLOSES_AFTER_MS = 60 * 60 * 1000;

export type TokenWindowState = 'open' | 'early' | 'over';

export interface TokenWindow {
	state: TokenWindowState;
	startsAt: number;
	endsAt: number;
}

// A meeting really ends when its room empties: the room server reports activity while the room
// is in use and once more when it empties. The hour after the end counts from the later of the
// scheduled end and that last activity, and someone entering in that hour starts it again.
const single = (startsAt: number, endsAt: number, now: number, lastActiveAt?: number): TokenWindow => {
	if (now < startsAt - TOKEN_OPENS_BEFORE_MS) return { state: 'early', startsAt, endsAt };

	const until = Math.max(endsAt, lastActiveAt ?? endsAt);

	if (now > until + TOKEN_CLOSES_AFTER_MS) return { state: 'over', startsAt, endsAt: until };

	return { state: 'open', startsAt, endsAt };
};

const asTime = (value: unknown): number | undefined => {
	if (value === null || value === undefined || value === '') return undefined;
	const n = Number(value);

	return Number.isFinite(n) ? n : undefined;
};

// The occurrence the window is about: the one open now, else the next one, else the last one.
export const meetingTokenWindow = (meeting: MeetingWindow, now: number): TokenWindow => {
	const startsAt = Number(meeting.startsAt);
	const endsAt = Number(meeting.endsAt);
	const lastActiveAt = asTime(meeting.lastActiveAt);

	if (!meeting.rrule) return single(startsAt, endsAt, now, lastActiveAt);
	// A series stored before the rules (rrulePolicy) cannot be expanded safely: its token keeps
	// working as it did before the window, rather than closing after the first occurrence.
	if (!isAllowedRrule(meeting.rrule) || startsAt < MEETING_TIME_MIN) return { state: 'open', startsAt, endsAt };

	const tz = usableZone(meeting.timezone);
	const duration = Math.max(0, endsAt - startsAt);

	try {
		const nowFloating = asFloating(now, tz).getTime();
		const rule = boundedRule(meeting.rrule, startsAt, tz, nowFloating);
		let found: { state: TokenWindowState, date: Date } | undefined;
		let last: Date | undefined;
		let seen = 0;

		rule.all((date) => {
			const start = date.getTime();

			if (start - TOKEN_OPENS_BEFORE_MS > nowFloating) {
				found = { state: 'early', date };

				return false;
			}
			if (nowFloating <= start + duration + TOKEN_CLOSES_AFTER_MS) {
				found = { state: 'open', date };

				return false;
			}
			last = date;

			return ++seen < MAX_OCCURRENCES;
		});

		// The previous occurrence may still be in use, or in its hour after the room emptied.
		if (last && found?.state !== 'open') {
			const previous = fromFloating(last, tz);
			const window = single(previous, previous + duration, now, lastActiveAt);

			if (window.state === 'open' || !found) return window;
		}
		if (!found) return single(startsAt, endsAt, now, lastActiveAt);
		const occurrence = fromFloating(found.date, tz);

		return { state: found.state, startsAt: occurrence, endsAt: occurrence + duration };
	} catch {
		return { state: 'open', startsAt, endsAt };
	}
};
