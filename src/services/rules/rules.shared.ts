// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers';
import type { ClientApplication } from '../../client';
import type { Rule, RuleData, RulePatch, RuleQuery, RuleService } from './rules.class';

export type { Rule, RuleData, RulePatch, RuleQuery };

export type RuleClientService = Pick<RuleService<Params<RuleQuery>>, (typeof ruleMethods)[number]>

export const rulePath = 'rules';

export const ruleMethods = [ 'find', 'get', 'create', 'patch', 'remove' ] as const;

export const ruleClient = (client: ClientApplication) => {
	const connection = client.get('connection');

	client.use(rulePath, connection.service(rulePath), {
		methods: ruleMethods
	});
};

// Add this service to the client service type index
declare module '../../client' {
	interface ServiceTypes {
		[rulePath]: RuleClientService
	}
}
