import { authenticate } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { checkPermissions } from '../../hooks/checkPermissions';
import { logger } from '../../logger';
import { decideBot, BotVerdict } from '../../bots/verify';
import type { TenantBotCredential } from '../tenantBotCredentials/tenantBotCredentials.schema';

const botVerifyPath = 'bot-verify';

export interface BotVerifyData {
	tenantId: number | string;
	botToken?: string;
	address: string;
}

declare module '../../declarations' {
	interface ServiceTypes {
		// eslint-disable-next-line no-unused-vars
		[botVerifyPath]: { create(_data: BotVerifyData, _params?: Params): Promise<BotVerdict> };
	}
}

// Asked by the room server for every headless connection into a tenant: applies
// the tenant's bot policy and, with a token, the matching credential and its
// address ranges. All bot rules live here so a policy change needs no restart.
export const botVerify = (app: Application) => {
	app.use(botVerifyPath, {
		async create(data: BotVerifyData): Promise<BotVerdict> {
			const tenantId = Number(data?.tenantId);

			if (!Number.isInteger(tenantId) || tenantId <= 0) throw new BadRequest('tenantId required');
			if (typeof data.address !== 'string' || !data.address) throw new BadRequest('address required');

			const internal = { provider: undefined, query: {} };
			const tenant = await app.service('tenants').get(tenantId, internal) as { botPolicy?: string | null };
			const botToken = typeof data.botToken === 'string' && data.botToken ? data.botToken : undefined;

			let credentials: TenantBotCredential[] = [];

			if (botToken) {
				const found = await app.service('tenantBotCredentials').find({ ...internal, query: { tenantId, $limit: 1000 }, paginate: false });

				credentials = found as TenantBotCredential[];
			}

			const verdict = decideBot({ policy: tenant?.botPolicy, botToken, address: data.address, credentials });

			// lastUsedAt is bookkeeping, not part of the credential's editable data,
			// so it is written straight to the table rather than through the service,
			// and a failed write must not turn a verified bot away.
			if (verdict.allowed && verdict.verified) {
				try {
					await app.get('postgresqlClient')('tenantBotCredentials')
						.where({ id: verdict.credentialId })
						.update({ lastUsedAt: Date.now() });
				} catch (err) {
					logger.warn('bot-verify: could not record the last use of a credential', err);
				}
			}

			return verdict;
		}
	}, { methods: [ 'create' ], events: [] });

	app.service(botVerifyPath).hooks({
		around: {
			all: [ authenticate('jwt') ]
		},
		before: {
			all: [ checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }) ]
		}
	});
};
