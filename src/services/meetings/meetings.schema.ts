import { randomUUID } from 'crypto';
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax, StringEnum } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

export const MeetingStatus = StringEnum([ 'CONFIRMED', 'CANCELLED' ]);

export const meetingSchema = Type.Object(
	{
		id: Type.Number(),
		roomId: Type.Number(),
		tenantId: Type.Number(),
		organizerId: Type.Number(),
		title: Type.String(),
		description: Type.Optional(Type.String()),
		startsAt: Type.Number(),
		endsAt: Type.Number(),
		timezone: Type.String(),
		locale: Type.String(),
		uid: Type.String(),
		sequence: Type.Number(),
		status: MeetingStatus,
		rrule: Type.Optional(Type.String()),
		recurrenceEnd: Type.Optional(Type.Number()),
		recurrenceCount: Type.Optional(Type.Number()),
		createdAt: Type.Number(),
		updatedAt: Type.Number(),

		// virtuals
		room: Type.Optional(Type.Any()),
		attendees: Type.Optional(Type.Array(Type.Any())),
	},
	{ $id: 'Meeting', additionalProperties: false }
);
export type Meeting = Static<typeof meetingSchema>
export const meetingResolver = resolve<Meeting, HookContext>({
	room: virtual(async (meeting, context) => {
		if (!meeting.roomId) return undefined;

		try {
			return await context.app.service('rooms').get(meeting.roomId);
		} catch {
			return undefined;
		}
	}),
	attendees: virtual(async (meeting, context) => {
		const result = await context.app.service('meetingAttendees').find({
			paginate: false,
			query: { meetingId: meeting.id }
		});

		return result as unknown[];
	}),
});

export const meetingExternalResolver = resolve<Meeting, HookContext>({});

// The UID's domain part is only a uniqueness convention (RFC 5545 leaves the form open),
// but `.local` is reserved for mDNS by RFC 6762, so use the tenant's own FQDN. A tenant may
// have several; the UID is persisted at creation, so whichever is primary then is fixed for
// the meeting's life and later FQDN changes cannot break existing invites. With no FQDN on
// record the bare UUID stands alone rather than inventing a domain.
const buildMeetingUid = async (context: HookContext): Promise<string> => {
	const id = randomUUID();
	const tenantId = context.params.user?.tenantId;

	if (tenantId == null) return id;

	try {
		const res = await context.app.service('tenantFQDNs').find({
			paginate: false,
			query: { tenantId: parseInt(String(tenantId)), $sort: { id: 1 }, $limit: 1 }
		});
		const list = Array.isArray(res) ? res : (res as { data: unknown[] }).data;
		const primary = (list as Array<{ fqdn?: string }>)[0]?.fqdn;

		return primary ? `${id}@${primary}` : id;
	} catch {
		return id;
	}
};

export const meetingDataSchema = Type.Omit(
	meetingSchema,
	[ 'id', 'tenantId', 'organizerId', 'uid', 'sequence', 'status', 'createdAt', 'updatedAt', 'room', 'attendees' ],
	{ $id: 'MeetingData', additionalProperties: false }
);
export type MeetingData = Static<typeof meetingDataSchema>
export const meetingDataValidator = getValidator(meetingDataSchema, dataValidator);
export const meetingDataResolver = resolve<Meeting, HookContext>({
	tenantId: async (_value, _data, context) => {
		if (context.params.user?.tenantId != null)
			return parseInt(String(context.params.user.tenantId));

		return undefined;
	},
	organizerId: async (_value, _data, context) => context.params.user?.id,
	uid: async (_value, _data, context) => buildMeetingUid(context),
	sequence: async () => 0,
	status: async () => 'CONFIRMED' as const,
	locale: async (value) => value ?? 'en',
	createdAt: async () => Date.now(),
	updatedAt: async () => Date.now()
});

export const meetingPatchSchema = Type.Partial(
	Type.Omit(meetingSchema, [
		'id', 'tenantId', 'organizerId', 'uid', 'createdAt', 'room', 'attendees'
	]),
	{ $id: 'MeetingPatch' }
);
export type MeetingPatch = Static<typeof meetingPatchSchema>
export const meetingPatchValidator = getValidator(meetingPatchSchema, dataValidator);
export const meetingPatchResolver = resolve<Meeting, HookContext>({
	updatedAt: async () => Date.now()
});

export const meetingQueryProperties = Type.Pick(meetingSchema, [ 'id', 'tenantId', 'roomId', 'organizerId', 'status', 'uid' ]);
export const meetingQuerySchema = Type.Intersect(
	[
		querySyntax(meetingQueryProperties),
		Type.Object({
			upcomingForMe: Type.Optional(Type.Boolean())
		}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type MeetingQuery = Static<typeof meetingQuerySchema>
export const meetingQueryValidator = getValidator(meetingQuerySchema, queryValidator);
export const meetingQueryResolver = resolve<MeetingQuery, HookContext>({
	tenantId: async (value, _query, context) => {
		if (context.params.user?.tenantId != null)
			return parseInt(String(context.params.user.tenantId));

		return value;
	}
});
