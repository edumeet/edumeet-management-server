import { authenticate } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { checkPermissions } from '../../hooks/checkPermissions';
import { logger } from '../../logger';
import { decrypt } from '../../invites/crypto';
import { asBotJobTypes, BotJobType } from '../../bots/verify';
import type { TenantBotCredential } from '../tenantBotCredentials/tenantBotCredentials.schema';

const botProviderPath = 'bot-providers';

export interface BotProvider {
	credentialId: number;
	label: string;
	jobTypes: BotJobType[];
	apiUrl: string;
	apiSecret: string;
}

declare module '../../declarations' {
	interface ServiceTypes {
		// eslint-disable-next-line no-unused-vars
		[botProviderPath]: { find(_params?: Params): Promise<BotProvider[]> };
	}
}

// The room server reads a room's tenant providers here once, when the room is
// created. This is the only way the provider api key leaves the server, which is
// why the service is limited to the room server's own role.
export const botProviders = (app: Application) => {
	app.use(botProviderPath, {
		async find(params?: Params): Promise<BotProvider[]> {
			const tenantId = Number(params?.query?.tenantId);

			if (!Number.isInteger(tenantId) || tenantId <= 0) throw new BadRequest('tenantId required');

			const internal = { provider: undefined, query: {} };
			const tenant = await app.service('tenants').get(tenantId, internal) as { botPolicy?: string | null };

			if (tenant?.botPolicy !== 'tokenOnly' && tenant?.botPolicy !== 'all') return [];

			const key = app.get('bots')?.encryptionKey;

			if (!key) {
				logger.warn('bot-providers: bots.encryptionKey is not configured, no providers are handed out');

				return [];
			}

			const rows = await app.service('tenantBotCredentials').find({
				...internal, query: { tenantId, enabled: true, $limit: 1000 }, paginate: false
			}) as TenantBotCredential[];

			const providers: BotProvider[] = [];

			for (const row of rows) {
				const jobTypes = asBotJobTypes(row.jobTypes);

				if (!row.apiUrl || !row.apiSecret || jobTypes.length === 0) continue;

				try {
					providers.push({
						credentialId: Number(row.id),
						label: row.label,
						jobTypes,
						apiUrl: row.apiUrl,
						apiSecret: decrypt(row.apiSecret, key, 'bots.encryptionKey')
					});
				} catch (err) {
					logger.warn(`bot-providers: could not read the api key of credential ${row.id}`, err);
				}
			}

			return providers;
		}
	}, { methods: [ 'find' ], events: [] });

	app.service(botProviderPath).hooks({
		around: {
			all: [ authenticate('jwt') ]
		},
		before: {
			all: [ checkPermissions({ roles: [ 'super-admin', 'edumeet-server' ] }) ]
		}
	});
};
