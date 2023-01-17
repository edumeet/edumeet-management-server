// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	Organization,
	OrganizationData,
	OrganizationPatch,
	OrganizationQuery
} from './organizations.schema';

export type OrganizationParams = KnexAdapterParams<OrganizationQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class OrganizationService<ServiceParams extends Params = OrganizationParams> extends KnexService<
	Organization,
	OrganizationData,
	ServiceParams,
	OrganizationPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'organizations'
	};
};
