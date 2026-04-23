import { authenticate } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';
import { iff } from 'feathers-hooks-common';

import type { Application } from '../../declarations';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';
import { testInviteConfig, TestResult } from '../../invites/tester';

const inviteTestPath = 'invite-tests';

export interface InviteTestData {
	tenantId?: number;
}

declare module '../../declarations' {
	interface ServiceTypes {
		// eslint-disable-next-line no-unused-vars
		[inviteTestPath]: { create(_data: InviteTestData, _params?: Params): Promise<TestResult> };
	}
}

export const inviteTest = (app: Application) => {
	app.use(inviteTestPath, {
		async create(data: InviteTestData, params?: Params): Promise<TestResult> {
			const tenantId = data?.tenantId ?? params?.user?.tenantId;

			if (!tenantId) throw new Error('tenantId required');

			return testInviteConfig(app, Number(tenantId));
		}
	}, { methods: [ 'create' ], events: [] });

	app.service(inviteTestPath).hooks({
		around: {
			all: [ authenticate('jwt') ]
		},
		before: {
			all: [ iff(notSuperAdmin(), isTenantAdmin) ]
		}
	});
};
