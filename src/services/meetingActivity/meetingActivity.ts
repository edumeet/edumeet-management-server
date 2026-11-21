import { authenticate } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { checkPermissions } from '../../hooks/checkPermissions';

const meetingActivityPath = 'meeting-activity';

export interface MeetingActivityData {
	roomId: number | string;
	meetingToken: string;
}

declare module '../../declarations' {
	interface ServiceTypes {
		// eslint-disable-next-line no-unused-vars
		[meetingActivityPath]: { create(_data: MeetingActivityData, _params?: Params): Promise<{ updated: number }> };
	}
}

// The room server reports that a meeting's room is in use. The time is bookkeeping, not part of
// the meeting's editable data: written straight to the table, so no hook bumps the sequence or
// sends the invitation again.
export const meetingActivity = (app: Application) => {
	app.use(meetingActivityPath, {
		async create(data: MeetingActivityData): Promise<{ updated: number }> {
			const roomId = Number(data?.roomId);

			if (!Number.isInteger(roomId) || roomId <= 0) throw new BadRequest('roomId required');
			if (typeof data.meetingToken !== 'string' || !data.meetingToken) throw new BadRequest('meetingToken required');

			const updated = await app.get('postgresqlClient')('meetings')
				.where({ roomId, meetingToken: data.meetingToken })
				.update({ lastActiveAt: Date.now() });

			return { updated: Number(updated) };
		}
	}, { methods: [ 'create' ], events: [] });

	app.service(meetingActivityPath).hooks({
		around: {
			all: [ authenticate('jwt') ]
		},
		before: {
			all: [ checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }) ]
		}
	});
};
