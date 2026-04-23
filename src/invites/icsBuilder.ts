import ical, { ICalCalendarMethod, ICalEventStatus, ICalAttendeeStatus, ICalAttendeeRole } from 'ical-generator';
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

	const cal = ical({
		prodId: PROD_ID,
		method
	});

	const event = cal.createEvent({
		id: meeting.uid,
		sequence: meeting.sequence,
		// Emit DTSTART/DTEND in UTC (no TZID). Maximum compatibility — every calendar
		// client handles `YYYYMMDDTHHMMSSZ` without needing a VTIMEZONE block. Using
		// TZID=Europe/Berlin without VTIMEZONE tripped some installations (Thunderbird
		// error 80004005, etc.). The UTC moment is identical either way.
		// Coerce — Postgres bigint serializes as string; new Date(string) misparses.
		start: new Date(Number(meeting.startsAt)),
		end: new Date(Number(meeting.endsAt)),
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
