// What a meeting's recurrence rule and times may be. Shared by the meeting schema, the
// server's own expansion (meetingWindow) and the invitation builder (icsBuilder), so a rule
// stored before these limits existed is treated the same as one refused now.

// The rules the meeting dialog writes (FREQ, INTERVAL, COUNT), plus UNTIL, BYDAY and WKST.
// - No HOURLY, MINUTELY or SECONDLY and no BYHOUR/BYMINUTE/BYSECOND: those multiply the
//   occurrences the server and every client expand.
// - No BYMONTH, BYMONTHDAY or BYSETPOS, and BYDAY ordinals only up to 5: with those a rule
//   can match nothing (BYMONTH=2;BYMONTHDAY=30), and rrule then walks every period up to
//   the year 9999 looking for an occurrence, whatever end or count it is given.
// - One line, so it cannot add lines to the invitation.
const DAY = '([+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)';

export const RRULE_PATTERN = [
	'^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)',
	'(;(',
	[
		'INTERVAL=[1-9][0-9]{0,2}',
		'COUNT=[1-9][0-9]{0,3}',
		'UNTIL=[0-9]{8}(T[0-9]{6}Z?)?',
		`BYDAY=${DAY}(,${DAY})*`,
		'WKST=(MO|TU|WE|TH|FR|SA|SU)'
	].join('|'),
	'))*$'
].join('');

export const RRULE_MAX_LENGTH = 200;

const RRULE_REGEX = new RegExp(RRULE_PATTERN);

export const isAllowedRrule = (rrule: unknown): rrule is string =>
	typeof rrule === 'string' && rrule.length <= RRULE_MAX_LENGTH && RRULE_REGEX.test(rrule);

// Meeting times: 2000-01-01 to 2100-01-01. A start far in the past makes every expansion
// walk from there to today.
export const MEETING_TIME_MIN = Date.UTC(2000, 0, 1);
export const MEETING_TIME_MAX = Date.UTC(2100, 0, 1);

const inMeetingTime = (value: unknown): boolean => {
	const time = Number(value);

	return Number.isFinite(time) && time >= MEETING_TIME_MIN && time <= MEETING_TIME_MAX;
};

/**
 * Whether a stored meeting's recurrence may be expanded: its rule passes the policy and its
 * times are in range. Meetings stored before these limits are shown and sent as single ones.
 */
export const isExpandableMeeting = (meeting: { rrule?: unknown, startsAt?: unknown, endsAt?: unknown }): boolean =>
	isAllowedRrule(meeting.rrule) && inMeetingTime(meeting.startsAt) && inMeetingTime(meeting.endsAt);
