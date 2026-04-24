import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { Partstat } from '../meetingAttendees/meetingAttendees.schema';

export const meetingOccurrenceRsvpSchema = Type.Object(
	{
		id: Type.Number(),
		meetingAttendeeId: Type.Number(),
		// Epoch ms of the original occurrence start — equivalent to iCal RECURRENCE-ID
		recurrenceId: Type.Number(),
		partstat: Partstat,
		replyDtstamp: Type.Optional(Type.Union([ Type.Number(), Type.Null() ])),
		replySequence: Type.Optional(Type.Union([ Type.Number(), Type.Null() ])),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
	},
	{ $id: 'MeetingOccurrenceRsvp', additionalProperties: false }
);
export type MeetingOccurrenceRsvp = Static<typeof meetingOccurrenceRsvpSchema>
export const meetingOccurrenceRsvpResolver = resolve<MeetingOccurrenceRsvp, HookContext>({});
export const meetingOccurrenceRsvpExternalResolver = resolve<MeetingOccurrenceRsvp, HookContext>({});

export const meetingOccurrenceRsvpDataSchema = Type.Omit(
	meetingOccurrenceRsvpSchema,
	[ 'id', 'createdAt', 'updatedAt' ],
	{ $id: 'MeetingOccurrenceRsvpData', additionalProperties: false }
);
export type MeetingOccurrenceRsvpData = Static<typeof meetingOccurrenceRsvpDataSchema>
export const meetingOccurrenceRsvpDataValidator = getValidator(meetingOccurrenceRsvpDataSchema, dataValidator);
export const meetingOccurrenceRsvpDataResolver = resolve<MeetingOccurrenceRsvp, HookContext>({
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now()
});

export const meetingOccurrenceRsvpPatchSchema = Type.Partial(
	Type.Omit(meetingOccurrenceRsvpSchema, [ 'id', 'meetingAttendeeId', 'recurrenceId', 'createdAt' ]),
	{ $id: 'MeetingOccurrenceRsvpPatch' }
);
export type MeetingOccurrenceRsvpPatch = Static<typeof meetingOccurrenceRsvpPatchSchema>
export const meetingOccurrenceRsvpPatchValidator = getValidator(meetingOccurrenceRsvpPatchSchema, dataValidator);
export const meetingOccurrenceRsvpPatchResolver = resolve<MeetingOccurrenceRsvp, HookContext>({
	updatedAt: async () => Date.now()
});

export const meetingOccurrenceRsvpQueryProperties = Type.Pick(
	meetingOccurrenceRsvpSchema,
	[ 'id', 'meetingAttendeeId', 'recurrenceId' ]
);
export const meetingOccurrenceRsvpQuerySchema = Type.Intersect(
	[
		querySyntax(meetingOccurrenceRsvpQueryProperties),
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type MeetingOccurrenceRsvpQuery = Static<typeof meetingOccurrenceRsvpQuerySchema>
export const meetingOccurrenceRsvpQueryValidator = getValidator(meetingOccurrenceRsvpQuerySchema, queryValidator);
export const meetingOccurrenceRsvpQueryResolver = resolve<MeetingOccurrenceRsvpQuery, HookContext>({});
