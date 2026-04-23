import { authenticate } from '@feathersjs/authentication';
import { hooks as schemaHooks } from '@feathersjs/schema';
import type { Knex } from 'knex';

import {
	meetingDataValidator,
	meetingPatchValidator,
	meetingQueryValidator,
	meetingResolver,
	meetingExternalResolver,
	meetingDataResolver,
	meetingPatchResolver,
	meetingQueryResolver
} from './meetings.schema';

import type { Application, HookContext } from '../../declarations';
import { MeetingService, getOptions } from './meetings.class';
import { meetingPath, meetingMethods } from './meetings.shared';
import { isRoomOwnerOrAdminForMeeting } from '../../hooks/isRoomOwnerOrAdminForMeeting';
import { beforeMeetingRemoveDispatch } from '../../invites/dispatcher';

export * from './meetings.class';
export * from './meetings.schema';

const computeVisibleMeetingIds = async (context: HookContext, userId: number): Promise<number[]> => {
	const knex = context.app.get('postgresqlClient');

	const [ attendeeRows, ownerRows ] = await Promise.all([
		knex('meetingAttendees')
			.select('meetingId')
			.where({ userId }),
		knex('roomOwners')
			.select('roomId')
			.where({ userId })
	]);
	const attendeeMeetingIds = attendeeRows.map((r: { meetingId: number }) => r.meetingId);
	const ownedRoomIds = ownerRows.map((r: { roomId: number }) => r.roomId);

	const rows = await knex('meetings')
		.select('id')
		.where((qb: Knex.QueryBuilder) => {
			qb.where('organizerId', userId);
			if (attendeeMeetingIds.length > 0) qb.orWhereIn('id', attendeeMeetingIds);
			if (ownedRoomIds.length > 0) qb.orWhereIn('roomId', ownedRoomIds);
		});

	return rows.map((r: { id: number }) => r.id);
};

// restricts find to meetings a non-admin user is involved in: organizer, attendee, or room owner
const scopeFindVisibility = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;
	const user = context.params.user;

	if (!user) return;
	if (user.tenantAdmin || user.tenantOwner) return;

	const visibleIds = await computeVisibleMeetingIds(context, user.id);
	const query = context.params.query ?? {};

	if (visibleIds.length === 0) {
		query.id = -1;
	} else if (query.id !== undefined) {
		const existing = query.id;

		if (typeof existing === 'number' || typeof existing === 'string') {
			const n = Number(existing);

			query.id = visibleIds.includes(n) ? n : -1;
		} else if (existing && typeof existing === 'object' && Array.isArray(existing.$in)) {
			const intersect = (existing.$in as number[]).filter((i) => visibleIds.includes(i));

			query.id = intersect.length > 0 ? { $in: intersect } : -1;
		} else {
			query.id = { $in: visibleIds };
		}
	} else {
		query.id = { $in: visibleIds };
	}
	context.params.query = query;
};

// restricts get — validates context.id is in the visible set for non-admins
const scopeGetVisibility = async (context: HookContext): Promise<void> => {
	if (!context.params.provider) return;
	const user = context.params.user;

	if (!user) return;
	if (user.tenantAdmin || user.tenantOwner) return;
	if (context.id === undefined || context.id === null) return;

	const visibleIds = await computeVisibleMeetingIds(context, user.id);

	if (!visibleIds.includes(Number(context.id)))
		throw new Error('Meeting not found');
};

// rewrites query.upcomingForMe into an id $in filter of meetings the user organizes or attends
const applyUpcomingForMe = async (context: HookContext): Promise<void> => {
	const query = context.params.query ?? {};

	if (!query.upcomingForMe) return;
	const userId = context.params.user?.id;

	if (!userId) {
		delete query.upcomingForMe;

		return;
	}

	const knex = context.app.get('postgresqlClient');
	const now = Date.now();

	const attendeeRows = await knex('meetingAttendees')
		.select('meetingId')
		.where({ userId });
	const attendeeMeetingIds = attendeeRows.map((r: { meetingId: number }) => r.meetingId);

	const rows = await knex('meetings')
		.select('id')
		.where((qb: Knex.QueryBuilder) => {
			qb.where('organizerId', userId);
			if (attendeeMeetingIds.length > 0) qb.orWhereIn('id', attendeeMeetingIds);
		})
		.andWhere((qb: Knex.QueryBuilder) => {
			qb.where('endsAt', '>', now);
			qb.orWhere('recurrenceEnd', '>', now);
			qb.orWhereNull('recurrenceEnd');
		})
		.andWhereNot('status', 'CANCELLED');

	const ids = rows.map((r: { id: number }) => r.id);

	delete query.upcomingForMe;
	query.id = ids.length > 0 ? { $in: ids } : -1;
	context.params.query = query;
};

export const meeting = (app: Application) => {
	app.use(meetingPath, new MeetingService(getOptions(app)), {
		methods: meetingMethods,
		events: []
	});

	app.service(meetingPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(meetingExternalResolver),
				schemaHooks.resolveResult(meetingResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(meetingQueryValidator),
				schemaHooks.resolveQuery(meetingQueryResolver)
			],
			find: [ applyUpcomingForMe, scopeFindVisibility ],
			get: [ scopeGetVisibility ],
			create: [
				isRoomOwnerOrAdminForMeeting,
				schemaHooks.validateData(meetingDataValidator),
				schemaHooks.resolveData(meetingDataResolver)
			],
			patch: [
				isRoomOwnerOrAdminForMeeting,
				schemaHooks.validateData(meetingPatchValidator),
				async (context) => {
					// bump sequence on every patch so attendees get iTIP REQUEST/CANCEL updates
					const current = await context.app.service('meetings').get(context.id as number);
					const data = context.data as Record<string, unknown>;

					data.sequence = (current.sequence ?? 0) + 1;
				},
				schemaHooks.resolveData(meetingPatchResolver)
			],
			remove: [ isRoomOwnerOrAdminForMeeting, beforeMeetingRemoveDispatch ]
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
		[meetingPath]: MeetingService
	}
}
