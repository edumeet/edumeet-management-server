import { authenticate } from '@feathersjs/authentication';
import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	meetingOccurrenceRsvpDataValidator,
	meetingOccurrenceRsvpPatchValidator,
	meetingOccurrenceRsvpQueryValidator,
	meetingOccurrenceRsvpResolver,
	meetingOccurrenceRsvpExternalResolver,
	meetingOccurrenceRsvpDataResolver,
	meetingOccurrenceRsvpPatchResolver,
	meetingOccurrenceRsvpQueryResolver
} from './meetingOccurrenceRsvps.schema';

import type { Application } from '../../declarations';
import { MeetingOccurrenceRsvpService, getOptions } from './meetingOccurrenceRsvps.class';
import { meetingOccurrenceRsvpPath, meetingOccurrenceRsvpMethods } from './meetingOccurrenceRsvps.shared';
import { isRoomOwnerOrAdminForMeetingOccurrenceRsvp } from '../../hooks/isRoomOwnerOrAdminForMeeting';

export * from './meetingOccurrenceRsvps.class';
export * from './meetingOccurrenceRsvps.schema';

export const meetingOccurrenceRsvp = (app: Application) => {
	app.use(meetingOccurrenceRsvpPath, new MeetingOccurrenceRsvpService(getOptions(app)), {
		methods: meetingOccurrenceRsvpMethods,
		events: []
	});

	app.service(meetingOccurrenceRsvpPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(meetingOccurrenceRsvpExternalResolver),
				schemaHooks.resolveResult(meetingOccurrenceRsvpResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(meetingOccurrenceRsvpQueryValidator),
				schemaHooks.resolveQuery(meetingOccurrenceRsvpQueryResolver)
			],
			find: [ isRoomOwnerOrAdminForMeetingOccurrenceRsvp ],
			get: [ isRoomOwnerOrAdminForMeetingOccurrenceRsvp ],
			create: [
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp,
				schemaHooks.validateData(meetingOccurrenceRsvpDataValidator),
				schemaHooks.resolveData(meetingOccurrenceRsvpDataResolver)
			],
			patch: [
				isRoomOwnerOrAdminForMeetingOccurrenceRsvp,
				schemaHooks.validateData(meetingOccurrenceRsvpPatchValidator),
				schemaHooks.resolveData(meetingOccurrenceRsvpPatchResolver)
			],
			remove: [ isRoomOwnerOrAdminForMeetingOccurrenceRsvp ]
		},
		after: {
			all: []
		},
		error: {
			all: []
		}
	});
};

declare module '../../declarations' {
	interface ServiceTypes {
		[meetingOccurrenceRsvpPath]: MeetingOccurrenceRsvpService
	}
}
