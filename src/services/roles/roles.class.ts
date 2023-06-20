// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Role, RoleData, RolePatch, RoleQuery } from './roles.schema';

export type { Role, RoleData, RolePatch, RoleQuery };

export type RoleParams = KnexAdapterParams<RoleQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RoleService<ServiceParams extends Params = RoleParams> extends KnexService<
	Role,
	RoleData,
	RoleParams,
	RolePatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'roles'
	};
};
