import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	MeetingAttendee,
	MeetingAttendeeData,
	MeetingAttendeePatch,
	MeetingAttendeeQuery,
	MeetingAttendeeService
} from './meetingAttendees.class';

export type { MeetingAttendee, MeetingAttendeeData, MeetingAttendeePatch, MeetingAttendeeQuery };

export type MeetingAttendeeClientService = Pick<
	MeetingAttendeeService<Params<MeetingAttendeeQuery>>,
	(typeof meetingAttendeeMethods)[number]
>

export const meetingAttendeePath = 'meetingAttendees';

export const meetingAttendeeMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const meetingAttendeeClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(meetingAttendeePath, connection.service(meetingAttendeePath), {
		methods: meetingAttendeeMethods
	});
};

declare module '../../client' {
	interface ServiceTypes {
		[meetingAttendeePath]: MeetingAttendeeClientService
	}
}
