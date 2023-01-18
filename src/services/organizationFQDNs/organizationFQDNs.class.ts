// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	OrganizationFqdn,
	OrganizationFqdnData,
	OrganizationFqdnPatch,
	OrganizationFqdnQuery
} from './organizationFQDNs.schema';

export type OrganizationFqdnParams = KnexAdapterParams<OrganizationFqdnQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class OrganizationFqdnService<
	ServiceParams extends Params = OrganizationFqdnParams
> extends KnexService<OrganizationFqdn, OrganizationFqdnData, ServiceParams, OrganizationFqdnPatch> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'organizationFQDNs'
	};
};
