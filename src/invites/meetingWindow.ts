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

export const isMeetingOver = (meeting: MeetingWindow, now: number): boolean => {
	const startsAt = Number(meeting.startsAt);
	const endsAt = Number(meeting.endsAt);

	if (!meeting.rrule) return endsAt < now;

	const tz = usableZone(meeting.timezone);
	const duration = Math.max(0, endsAt - startsAt);

	try {
		const rule = rrulestr(meeting.rrule, { dtstart: asFloating(startsAt, tz) });

		if (rule.after(asFloating(now, tz), true)) return false;

		const last = rule.before(asFloating(now, tz), true);

		if (!last) return endsAt < now;

		return fromFloating(last, tz) + duration < now;
	} catch {
		return endsAt < now;
	}
};
