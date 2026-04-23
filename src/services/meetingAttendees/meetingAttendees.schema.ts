import { resolve } from '@feathersjs/schema';
import { Type, getValidator, querySyntax, StringEnum } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';
import { hmacToken } from '../../invites/crypto';

export const Partstat = StringEnum([ 'NEEDS-ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE' ]);

export const meetingAttendeeSchema = Type.Object(
	{
		id: Type.Number(),
		meetingId: Type.Number(),
		userId: Type.Optional(Type.Number()),
		email: Type.String({ format: 'email' }),
		name: Type.Optional(Type.String()),
		partstat: Partstat,
		rsvpToken: Type.String(),
		lastNotifiedSequence: Type.Number(),
		replyDtstamp: Type.Optional(Type.Union([ Type.Number(), Type.Null() ])),
		replySequence: Type.Optional(Type.Union([ Type.Number(), Type.Null() ])),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),
	},
	{ $id: 'MeetingAttendee', additionalProperties: false }
);
export type MeetingAttendee = Static<typeof meetingAttendeeSchema>
export const meetingAttendeeResolver = resolve<MeetingAttendee, HookContext>({});

export const meetingAttendeeExternalResolver = resolve<MeetingAttendee, HookContext>({
	// rsvpToken is a per-attendee secret used to validate inbound REPLY matching — never expose
	rsvpToken: async () => undefined,
});

export const meetingAttendeeDataSchema = Type.Omit(
	meetingAttendeeSchema,
	[ 'id', 'partstat', 'rsvpToken', 'lastNotifiedSequence', 'replyDtstamp', 'replySequence', 'createdAt', 'updatedAt' ],
	{ $id: 'MeetingAttendeeData', additionalProperties: false }
);
export type MeetingAttendeeData = Static<typeof meetingAttendeeDataSchema>
export const meetingAttendeeDataValidator = getValidator(meetingAttendeeDataSchema, dataValidator);
export const meetingAttendeeDataResolver = resolve<MeetingAttendee, HookContext>({
	email: async (value) => value?.toLowerCase(),
	partstat: async () => 'NEEDS-ACTION' as const,
	rsvpToken: async (_value, data, context) => {
		const invites = context.app.get('invites');

		if (!invites?.rsvpTokenSecret)
			throw new Error('invites.rsvpTokenSecret not configured');

		const meetingId = (data as { meetingId?: number }).meetingId;
		const email = (data as { email?: string }).email;

		if (!meetingId || !email)
			throw new Error('meetingId and email required');

		return hmacToken(meetingId, email, invites.rsvpTokenSecret);
	},
	lastNotifiedSequence: async () => -1,
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now()
});

export const meetingAttendeePatchSchema = Type.Partial(
	Type.Omit(meetingAttendeeSchema, [ 'id', 'meetingId', 'rsvpToken', 'createdAt' ]),
	{ $id: 'MeetingAttendeePatch' }
);
export type MeetingAttendeePatch = Static<typeof meetingAttendeePatchSchema>
export const meetingAttendeePatchValidator = getValidator(meetingAttendeePatchSchema, dataValidator);
export const meetingAttendeePatchResolver = resolve<MeetingAttendee, HookContext>({
	email: async (value) => value?.toLowerCase(),
	updatedAt: async () => Date.now()
});

export const meetingAttendeeQueryProperties = Type.Pick(
	meetingAttendeeSchema,
	[ 'id', 'meetingId', 'userId', 'email' ]
);
export const meetingAttendeeQuerySchema = Type.Intersect(
	[
		querySyntax(meetingAttendeeQueryProperties),
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type MeetingAttendeeQuery = Static<typeof meetingAttendeeQuerySchema>
export const meetingAttendeeQueryValidator = getValidator(meetingAttendeeQuerySchema, queryValidator);
export const meetingAttendeeQueryResolver = resolve<MeetingAttendeeQuery, HookContext>({});
