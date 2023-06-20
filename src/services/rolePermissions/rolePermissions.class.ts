// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type {
	RolePermission,
	RolePermissionData,
	RolePermissionPatch,
	RolePermissionQuery
} from './rolePermissions.schema';

export type { RolePermission, RolePermissionData, RolePermissionPatch, RolePermissionQuery };

export type RolePermissionParams = KnexAdapterParams<RolePermissionQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RolePermissionService<ServiceParams extends Params = RolePermissionParams> extends KnexService<
	RolePermission,
	RolePermissionData,
	RolePermissionParams,
	RolePermissionPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'rolePermissions'
	};
};
