// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema';
import { Type, getValidator, querySyntax } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import type { HookContext } from '../../declarations';
import { dataValidator, queryValidator } from '../../validators';

// Main data model schema
export const ruleSchema = Type.Object(
	{
		id: Type.Number(),
		name: Type.String(),
		tenantId: Type.Number(),
		parameter: Type.String(), // user parameter to check for method (like: email)
		method: Type.String(), // contains, equals, startswith, endswith
		negate: Type.Boolean(), // true/false  negates method
		value: Type.String(), // int / string that parameter is matched with
		action: Type.String(), // that we want to do user to group,role,...
		type: Type.String(), // gain / assert
		accessId: Type.String() // id for the service permission that can be gained
	},
	{ $id: 'Rule', additionalProperties: false }
);
export type Rule = Static<typeof ruleSchema>
export const ruleResolver = resolve<Rule, HookContext>({
	
});

export const ruleExternalResolver = resolve<Rule, HookContext>({});

// Schema for creating new entries
export const ruleDataSchema = Type.Pick(ruleSchema, [ 'name', 'tenantId', 'type', 'parameter', 'method', 'negate', 'action', 'accessId', 'value' ], {
	$id: 'RuleData'
});
export type RuleData = Static<typeof ruleDataSchema>
export const ruleDataValidator = getValidator(ruleDataSchema, dataValidator);
export const ruleDataResolver = resolve<Rule, HookContext>({
	tenantId: async (value, query, context) => {
		// Make sure the user is limited to their own tenant
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	}
});

// Schema for updating existing entries
export const rulePatchSchema = Type.Partial(ruleDataSchema, {
	$id: 'RulePatch'
});
export type RulePatch = Static<typeof rulePatchSchema>
export const rulePatchValidator = getValidator(rulePatchSchema, dataValidator);
export const rulePatchResolver = resolve<Rule, HookContext>({});

// Schema for allowed query properties
export const ruleQueryProperties = Type.Pick(ruleSchema, [ 'id', 'name', 'tenantId', 'type' ]);
export const ruleQuerySchema = Type.Intersect(
	[
		querySyntax(ruleQueryProperties),
		// Add additional query properties here
		Type.Object({}, { additionalProperties: false })
	],
	{ additionalProperties: false }
);
export type RuleQuery = Static<typeof ruleQuerySchema>
export const ruleQueryValidator = getValidator(ruleQuerySchema, queryValidator);
export const ruleQueryResolver = resolve<RuleQuery, HookContext>({
	tenantId: async (value, query, context) => {
		if (context.params.user)
			return context.params.user.tenantId;

		return value;
	},
});
