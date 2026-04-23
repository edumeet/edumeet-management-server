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
		// Coerce — Postgres bigint serializes as string; new Date(string) misparses.
		start: new Date(Number(meeting.startsAt)),
		end: new Date(Number(meeting.endsAt)),
		timezone: meeting.timezone,
		summary: meeting.title,
		description: meeting.description,
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
		event.createAttendee({
			name: a.name,
			email: a.email,
			rsvp: true,
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
