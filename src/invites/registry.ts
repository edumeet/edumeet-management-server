import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { reconcileSenders, closeAllSenders } from './sender';
import { reconcilePollers, stopAllPollers } from './replyPoller';
import { registerMeetingEventHandlers } from './dispatcher';

import { logger } from '../logger';

const loadConfigs = async (app: Application): Promise<TenantInviteConfig[]> => {
	const res = await app.service('tenantInviteConfigs').find({
		paginate: false,
		query: {}
	});
	const list = Array.isArray(res) ? res : (res as { data: unknown[] }).data;

	return list as TenantInviteConfig[];
};

// Senders and pollers are both deduped per mailbox, so any config change requires the full
// picture to know whether a shared mailbox still has other tenants keeping it alive.
// Re-fetch all configs and reconcile both sides from the same snapshot.
const refreshWorkers = async (app: Application): Promise<void> => {
	const configs = await loadConfigs(app);

	reconcileSenders(app, configs);
	reconcilePollers(app, configs);
};

export const startInviteWorkers = async (app: Application): Promise<void> => {
	const invites = app.get('invites');

	if (!invites?.encryptionKey || !invites?.rsvpTokenSecret) {
		logger.warn('[invites/registry] invites config missing; workers disabled');

		return;
	}

	registerMeetingEventHandlers(app);

	// boot pollers (one per unique mailbox across all tenant configs)
	await refreshWorkers(app);

	// react to config changes by reconciling both mailbox caches. These fire outside any
	// request, so a rejection here would surface as an unhandled rejection.
	const onConfigChange = (): void => {
		refreshWorkers(app).catch((err) => {
			logger.error('[invites/registry] worker reconcile failed:', err);
		});
	};

	app.service('tenantInviteConfigs').on('created', onConfigChange);
	app.service('tenantInviteConfigs').on('patched', onConfigChange);
	app.service('tenantInviteConfigs').on('removed', onConfigChange);
};

export const stopInviteWorkers = (): void => {
	stopAllPollers();
	closeAllSenders();
};
