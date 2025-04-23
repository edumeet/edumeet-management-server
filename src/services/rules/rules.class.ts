// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers';
import { KnexService } from '@feathersjs/knex';
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex';

import type { Application } from '../../declarations';
import type { Rule, RuleData, RulePatch, RuleQuery } from './rules.schema';

export type { Rule, RuleData, RulePatch, RuleQuery };

export type RuleParams = KnexAdapterParams<RuleQuery>

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class RuleService<ServiceParams extends Params = RuleParams> extends KnexService<
	Rule,
	RuleData,
	RuleParams,
	RulePatch
> {}

export const getOptions = (app: Application): KnexAdapterOptions => {
	return {
		paginate: app.get('paginate'),
		Model: app.get('postgresqlClient'),
		name: 'rules'
	};
};
