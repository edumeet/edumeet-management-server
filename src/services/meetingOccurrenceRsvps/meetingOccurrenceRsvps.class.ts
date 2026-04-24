import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	MeetingOccurrenceRsvp,
	MeetingOccurrenceRsvpData,
	MeetingOccurrenceRsvpPatch,
	MeetingOccurrenceRsvpQuery
} from './meetingOccurrenceRsvps.schema';

export type {
	MeetingOccurrenceRsvp,
	MeetingOccurrenceRsvpData,
	MeetingOccurrenceRsvpPatch,
	MeetingOccurrenceRsvpQuery
};

export type MeetingOccurrenceRsvpParams = KnexAdapterParams<MeetingOccurrenceRsvpQuery>

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export class MeetingOccurrenceRsvpService<ServiceParams extends Params = MeetingOccurrenceRsvpParams> extends KnexService<
	MeetingOccurrenceRsvp,
	MeetingOccurrenceRsvpData,
	MeetingOccurrenceRsvpParams,
	MeetingOccurrenceRsvpPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'meetingOccurrenceRsvps'
	};
};
