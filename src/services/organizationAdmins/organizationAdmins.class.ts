// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	OrganizationAdmin,
	OrganizationAdminData,
	OrganizationAdminPatch,
	OrganizationAdminQuery
} from './organizationAdmins.schema';

export type OrganizationAdminParams = KnexAdapterParams<OrganizationAdminQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class OrganizationAdminService<
	ServiceParams extends Params = OrganizationAdminParams
> extends KnexService<OrganizationAdmin, OrganizationAdminData, ServiceParams, OrganizationAdminPatch> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: false,
		Model: app.get('postgresqlClient'),
		name: 'organizationAdmins'
	};
};
