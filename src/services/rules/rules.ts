// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication';

import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	ruleDataValidator,
	rulePatchValidator,
	ruleQueryValidator,
	ruleResolver,
	ruleExternalResolver,
	ruleDataResolver,
	rulePatchResolver,
	ruleQueryResolver
} from './rules.schema';

import type { Application } from '../../declarations';
import { RuleService, getOptions } from './rules.class';
import { rulePath, ruleMethods } from './rules.shared';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { adminOnlyData } from '../../hooks/adminOnlyData';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { notInSameTenant, notInSameTenantByContextId } from '../../hooks/notSameTenant';
import { isInSameTenantAndTenantOwnerOrAdmin } from '../../hooks/isInSameTenantAndTenantOwnerOrAdmin';

export * from './rules.class';

// A configure function that registers the service and its hooks via `app.configure`
export const rule = (app: Application) => {
	// Register our service on the Feathers application
	app.use(rulePath, new RuleService(getOptions(app)), {
		// A list of all methods this service exposes externally
		methods: ruleMethods,
		// You can add additional custom events to be sent to clients here
		events: []
	});
	// Initialize hooks
	app.service(rulePath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(ruleExternalResolver),
				schemaHooks.resolveResult(ruleResolver)
			]
		},
		before: {
			all: [ schemaHooks.validateQuery(ruleQueryValidator),
				iff(notSuperAdmin(), isTenantAdmin, schemaHooks.resolveQuery(ruleQueryResolver)) ],
			
			find: [
			],
			get: [
			],
			create: [ 
				iff(notSuperAdmin(), adminOnlyData),
				schemaHooks.validateData(ruleDataValidator),
				schemaHooks.resolveData(ruleDataResolver)
			],
			patch: [ 
				iff(notSuperAdmin(), adminOnlyData),
				iff(notSuperAdmin(), notInSameTenant),
				schemaHooks.validateData(rulePatchValidator),
				schemaHooks.resolveData(rulePatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), notInSameTenantByContextId),
			]
		},
		after: {
			all: []
		},
		error: {
			all: []
		}
	});
};

// Add this service to the service type index
declare module '../../declarations' {
	interface ServiceTypes {
		[rulePath]: RuleService
	}
}
