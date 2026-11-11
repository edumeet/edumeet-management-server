import { authenticate } from '@feathersjs/authentication';
import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	meetingAttendeeDataValidator,
	meetingAttendeePatchValidator,
	meetingAttendeeQueryValidator,
	meetingAttendeeResolver,
	meetingAttendeeExternalResolver,
	meetingAttendeeDataResolver,
	meetingAttendeePatchResolver,
	meetingAttendeeQueryResolver
} from './meetingAttendees.schema';

import type { Application } from '../../declarations';
import { MeetingAttendeeService, getOptions } from './meetingAttendees.class';
import { meetingAttendeePath, meetingAttendeeMethods } from './meetingAttendees.shared';
import { isRoomOwnerOrAdminForMeetingAttendee } from '../../hooks/isRoomOwnerOrAdminForMeeting';
import { referencesInCallerTenant } from '../../hooks/referencesInCallerTenant';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { limitAttendeesPerMeeting } from '../../hooks/limitAttendeesPerMeeting';

export * from './meetingAttendees.class';
export * from './meetingAttendees.schema';

export const meetingAttendee = (app: Application) => {
	app.use(meetingAttendeePath, new MeetingAttendeeService(getOptions(app)), {
		methods: meetingAttendeeMethods,
		events: []
	});

	app.service(meetingAttendeePath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(meetingAttendeeExternalResolver),
				schemaHooks.resolveResult(meetingAttendeeResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(meetingAttendeeQueryValidator),
				schemaHooks.resolveQuery(meetingAttendeeQueryResolver)
			],
			find: [ isRoomOwnerOrAdminForMeetingAttendee ],
			get: [ isRoomOwnerOrAdminForMeetingAttendee ],
			create: [
				isRoomOwnerOrAdminForMeetingAttendee,
				schemaHooks.validateData(meetingAttendeeDataValidator),
				limitAttendeesPerMeeting,
				// an attendee who is a user must be one of the caller's tenant
				iff(notSuperAdmin(), referencesInCallerTenant([ 'userId' ])),
				schemaHooks.resolveData(meetingAttendeeDataResolver)
			],
			patch: [
				isRoomOwnerOrAdminForMeetingAttendee,
				schemaHooks.validateData(meetingAttendeePatchValidator),
				iff(notSuperAdmin(), referencesInCallerTenant([ 'userId' ])),
				schemaHooks.resolveData(meetingAttendeePatchResolver)
			],
			remove: [ isRoomOwnerOrAdminForMeetingAttendee ]
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
		[meetingAttendeePath]: MeetingAttendeeService
	}
}
