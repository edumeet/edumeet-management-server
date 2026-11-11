import { authenticate } from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import { iff } from 'feathers-hooks-common';

import type { Application, HookContext } from '../../declarations';
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

// A tenant admin tests the mail settings of their own tenant only; a test logs in to the
// configured servers with the stored passwords and reports what they answer.
export const ownTenantOnly = async (context: HookContext): Promise<HookContext> => {
	const own = context.params.user?.tenantId;
	const asked = (context.data as InviteTestData | undefined)?.tenantId;

	if (asked !== undefined && asked !== null && String(asked) !== String(own))
		throw new Forbidden('You can only test the invitation settings of your own tenant');

	context.data = { ...(context.data as InviteTestData | undefined), tenantId: own };

	return context;
};

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
			all: [ iff(notSuperAdmin(), isTenantAdmin, ownTenantOnly) ]
		}
	});
};
