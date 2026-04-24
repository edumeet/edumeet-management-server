import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type {
	Meeting,
	MeetingData,
	MeetingPatch,
	MeetingQuery,
	MeetingService
} from './meetings.class';

export type { Meeting, MeetingData, MeetingPatch, MeetingQuery };

export type MeetingClientService = Pick<
	MeetingService<Params<MeetingQuery>>,
	(typeof meetingMethods)[number]
>

export const meetingPath = 'meetings';

export const meetingMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const meetingClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(meetingPath, connection.service(meetingPath), {
		methods: meetingMethods
	});
};

declare module '../../client' {
	interface ServiceTypes {
		[meetingPath]: MeetingClientService
	}
}
