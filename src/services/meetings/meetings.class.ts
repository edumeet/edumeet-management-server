import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Meeting, MeetingData, MeetingPatch, MeetingQuery } from './meetings.schema';

export type { Meeting, MeetingData, MeetingPatch, MeetingQuery };

export type MeetingParams = KnexAdapterParams<MeetingQuery>

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export class MeetingService<ServiceParams extends Params = MeetingParams> extends KnexService<
	Meeting,
	MeetingData,
	MeetingParams,
	MeetingPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'meetings'
	};
};
