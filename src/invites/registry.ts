import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { invalidateSender } from './sender';
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

// Pollers are deduped per mailbox, so any config change requires the full picture to know
// whether a shared mailbox still has other tenants keeping it alive. Re-fetch all configs
// and reconcile. (The SMTP sender cache is still invalidated per tenant — independent of IMAP.)
const refreshPollers = async (app: Application): Promise<void> => {
	reconcilePollers(app, await loadConfigs(app));
};

export const startInviteWorkers = async (app: Application): Promise<void> => {
	const invites = app.get('invites');

	if (!invites?.encryptionKey || !invites?.rsvpTokenSecret) {
		logger.warn('[invites/registry] invites config missing; workers disabled');

		return;
	}

	registerMeetingEventHandlers(app);

	// boot pollers (one per unique mailbox across all tenant configs)
	await refreshPollers(app);

	// react to config changes — invalidate that tenant's sender, then reconcile mailbox pollers
	app.service('tenantInviteConfigs').on('created', (cfg: TenantInviteConfig) => {
		invalidateSender(cfg.tenantId);
		refreshPollers(app);
	});
	app.service('tenantInviteConfigs').on('patched', (cfg: TenantInviteConfig) => {
		invalidateSender(cfg.tenantId);
		refreshPollers(app);
	});
	app.service('tenantInviteConfigs').on('removed', (cfg: TenantInviteConfig) => {
		invalidateSender(cfg.tenantId);
		refreshPollers(app);
	});
};

export const stopInviteWorkers = (): void => {
	stopAllPollers();
};
