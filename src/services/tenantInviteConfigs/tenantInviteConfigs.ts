import { authenticate } from '@feathersjs/authentication';
import { hooks as schemaHooks } from '@feathersjs/schema';

import {
	tenantInviteConfigDataValidator,
	tenantInviteConfigPatchValidator,
	tenantInviteConfigQueryValidator,
	tenantInviteConfigResolver,
	tenantInviteConfigExternalResolver,
	tenantInviteConfigDataResolver,
	tenantInviteConfigPatchResolver,
	tenantInviteConfigQueryResolver
} from './tenantInviteConfigs.schema';

import type { Application } from '../../declarations';
import { TenantInviteConfigService, getOptions } from './tenantInviteConfigs.class';
import { tenantInviteConfigPath, tenantInviteConfigMethods } from './tenantInviteConfigs.shared';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { iff } from 'feathers-hooks-common';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

export * from './tenantInviteConfigs.class';
export * from './tenantInviteConfigs.schema';

export const tenantInviteConfig = (app: Application) => {
	app.use(tenantInviteConfigPath, new TenantInviteConfigService(getOptions(app)), {
		methods: tenantInviteConfigMethods,
		events: []
	});

	app.service(tenantInviteConfigPath).hooks({
		around: {
			all: [
				authenticate('jwt'),
				schemaHooks.resolveExternal(tenantInviteConfigExternalResolver),
				schemaHooks.resolveResult(tenantInviteConfigResolver)
			]
		},
		before: {
			all: [
				schemaHooks.validateQuery(tenantInviteConfigQueryValidator),
				schemaHooks.resolveQuery(tenantInviteConfigQueryResolver)
			],
			find: [],
			get: [],
			create: [
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantInviteConfigDataValidator),
				schemaHooks.resolveData(tenantInviteConfigDataResolver)
			],
			patch: [
				iff(notSuperAdmin(), isTenantAdmin),
				schemaHooks.validateData(tenantInviteConfigPatchValidator),
				schemaHooks.resolveData(tenantInviteConfigPatchResolver)
			],
			remove: [
				iff(notSuperAdmin(), isTenantAdmin)
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

declare module '../../declarations' {
	interface ServiceTypes {
		[tenantInviteConfigPath]: TenantInviteConfigService
	}
}
