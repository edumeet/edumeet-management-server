import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	MeetingOccurrenceRsvp,
	MeetingOccurrenceRsvpData,
	MeetingOccurrenceRsvpPatch,
	MeetingOccurrenceRsvpQuery,
	MeetingOccurrenceRsvpService
} from './meetingOccurrenceRsvps.class';

export type {
	MeetingOccurrenceRsvp,
	MeetingOccurrenceRsvpData,
	MeetingOccurrenceRsvpPatch,
	MeetingOccurrenceRsvpQuery
};

export type MeetingOccurrenceRsvpClientService = Pick<
	MeetingOccurrenceRsvpService<Params<MeetingOccurrenceRsvpQuery>>,
	(typeof meetingOccurrenceRsvpMethods)[number]
>

export const meetingOccurrenceRsvpPath = 'meetingOccurrenceRsvps';

export const meetingOccurrenceRsvpMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const meetingOccurrenceRsvpClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(meetingOccurrenceRsvpPath, connection.service(meetingOccurrenceRsvpPath), {
		methods: meetingOccurrenceRsvpMethods
	});
};

declare module '../../client' {
	interface ServiceTypes {
		[meetingOccurrenceRsvpPath]: MeetingOccurrenceRsvpClientService
	}
}
