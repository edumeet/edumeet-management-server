import ical, { ICalCalendarMethod, ICalEventStatus, ICalAttendeeStatus, ICalAttendeeRole } from 'ical-generator';
import { getVtimezoneComponent } from '@touch4it/ical-timezones';
import { TZDate } from '@date-fns/tz';
import type { Meeting } from '../services/meetings/meetings.schema';
import type { MeetingAttendee } from '../services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';

export interface IcsBuildInput {
	meeting: Meeting;
	attendees: MeetingAttendee[];
	tenantConfig: TenantInviteConfig;
	roomUrl: string;
	organizerUserName?: string;
}

const PROD_ID = '//edumeet//calendar-invites//EN';

const partstatToIcs = (p?: string): ICalAttendeeStatus => {
	switch (p) {
		case 'ACCEPTED': return ICalAttendeeStatus.ACCEPTED;
		case 'DECLINED': return ICalAttendeeStatus.DECLINED;
		case 'TENTATIVE': return ICalAttendeeStatus.TENTATIVE;
		default: return ICalAttendeeStatus.NEEDSACTION;
	}
};

const buildBase = (input: IcsBuildInput, method: ICalCalendarMethod) => {
	const { meeting, attendees, tenantConfig, roomUrl, organizerUserName } = input;

	// DTSTART/DTEND carry the meeting's TZID with an embedded VTIMEZONE, which is what an
	// RRULE needs to keep every occurrence at the same local time across a DST change: a
	// UTC instant plus FREQ=WEEKLY drifts by an hour in October. A TZID WITHOUT its
	// VTIMEZONE block is what tripped Thunderbird (error 80004005), so when the generator
	// does not know the zone the calendar falls back to plain UTC rather than emit one.
	//
	// The zone goes on the EVENT, not as the calendar default: a calendar-level zone makes
	// ical-generator render DTSTAMP as floating local time, and RFC 5545 requires DTSTAMP in
	// UTC. The calendar only carries the generator, so the event's TZID gets its block.
	const vtimezone = meeting.timezone ? getVtimezoneComponent(meeting.timezone) : null;
	const cal = ical({
		prodId: PROD_ID,
		method,
		...(vtimezone ? { timezone: { name: null, generator: getVtimezoneComponent } } : {})
	});

	// A plain Date is rendered with its LOCAL getters once a TZID is in play, i.e. in the
	// process zone, which is UTC in the container: a 16:00Z start went out labelled
	// "16:00 Europe/Berlin", two hours early. TZDate carries the meeting zone with the
	// instant, and ical-generator detects and converts it regardless of process zone.
	// Coerce first — Postgres bigint serializes as string; new Date(string) misparses.
	const at = (ms: unknown): Date => (vtimezone
		? new TZDate(Number(ms), meeting.timezone as string)
		: new Date(Number(ms)));

	const event = cal.createEvent({
		id: meeting.uid,
		sequence: meeting.sequence,
		...(vtimezone ? { timezone: meeting.timezone } : {}),
		start: at(meeting.startsAt),
		end: at(meeting.endsAt),
		summary: meeting.title,
		// Omit empty DESCRIPTION line — some calendar parsers complain about `DESCRIPTION:\r\n` with no value.
		description: (meeting.description && meeting.description.trim()) ? meeting.description : null,
		location: roomUrl,
		organizer: {
			// CN = the organizing user (for attribution); mailto = the mailbox where replies land.
			name: organizerUserName || tenantConfig.organizerName || tenantConfig.organizerAddress,
			email: tenantConfig.organizerAddress
		},
		status: meeting.status === 'CANCELLED' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED
	});

	if (meeting.rrule)
		event.repeating(meeting.rrule);

	for (const a of attendees) {
		// Emit CN only when a human-friendly name exists. Using the email as a fake CN
		// (what happens if a.name === a.email) is cosmetically ugly and adds no info.
		const hasRealName = a.name && a.name.trim() && a.name.trim().toLowerCase() !== a.email.toLowerCase();

		event.createAttendee({
			name: hasRealName ? a.name : null,
			email: a.email,
			// RSVP only makes sense on REQUEST (we're asking for a reply).
			// On CANCEL the attendee has nothing to respond to.
			rsvp: method === ICalCalendarMethod.REQUEST,
			role: ICalAttendeeRole.REQ,
			status: partstatToIcs(a.partstat)
		});
	}

	return cal;
};

export const buildRequestIcs = (input: IcsBuildInput): string => {
	return buildBase(input, ICalCalendarMethod.REQUEST).toString();
};

export const buildCancelIcs = (input: IcsBuildInput): string => {
	return buildBase(input, ICalCalendarMethod.CANCEL).toString();
};
