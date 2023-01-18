// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Permission, PermissionData, PermissionPatch, PermissionQuery } from './permissions.schema';

export type PermissionParams = KnexAdapterParams<PermissionQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class PermissionService<ServiceParams extends Params = PermissionParams> extends KnexService<
	Permission,
	PermissionData,
	ServiceParams,
	PermissionPatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'permissions'
	};
};
