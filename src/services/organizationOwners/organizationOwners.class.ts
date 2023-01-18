// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	OrganizationOwner,
	OrganizationOwnerData,
	OrganizationOwnerPatch,
	OrganizationOwnerQuery
} from './organizationOwners.schema';

export type OrganizationOwnerParams = KnexAdapterParams<OrganizationOwnerQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class OrganizationOwnerService<
	ServiceParams extends Params = OrganizationOwnerParams
> extends KnexService<OrganizationOwner, OrganizationOwnerData, ServiceParams, OrganizationOwnerPatch> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'organizationOwners'
	};
};
