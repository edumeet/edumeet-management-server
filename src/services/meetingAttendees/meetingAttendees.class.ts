import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	MeetingAttendee,
	MeetingAttendeeData,
	MeetingAttendeePatch,
	MeetingAttendeeQuery
} from './meetingAttendees.schema';

export type { MeetingAttendee, MeetingAttendeeData, MeetingAttendeePatch, MeetingAttendeeQuery };

export type MeetingAttendeeParams = KnexAdapterParams<MeetingAttendeeQuery>

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export class MeetingAttendeeService<ServiceParams extends Params = MeetingAttendeeParams> extends KnexService<
	MeetingAttendee,
	MeetingAttendeeData,
	MeetingAttendeeParams,
	MeetingAttendeePatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'meetingAttendees'
	};
};
