import type { Application } from '../declarations';
import type { TenantInviteConfig } from '../services/tenantInviteConfigs/tenantInviteConfigs.schema';
import { invalidateSender } from './sender';
import { startPollerForTenant, stopPollerForTenant, stopAllPollers } from './replyPoller';
import { registerMeetingEventHandlers } from './dispatcher';

const logger = console;

const rebuildTenantWorker = (app: Application, cfg: TenantInviteConfig): void => {
	invalidateSender(cfg.tenantId);
	if (cfg.enabled) {
		startPollerForTenant(app, cfg);
	} else {
		stopPollerForTenant(cfg.tenantId);
	}
};

export const startInviteWorkers = async (app: Application): Promise<void> => {
	const invites = app.get('invites');

	if (!invites?.encryptionKey || !invites?.rsvpTokenSecret) {
		logger.warn('[invites/registry] invites config missing; workers disabled');

		return;
	}

	registerMeetingEventHandlers(app);

	// boot per-tenant pollers
	const res = await app.service('tenantInviteConfigs').find({
		paginate: false,
		query: {}
	});
	const list = Array.isArray(res) ? res : (res as { data: unknown[] }).data;

	for (const cfg of list as TenantInviteConfig[]) {
		rebuildTenantWorker(app, cfg);
	}

	// react to config changes
	app.service('tenantInviteConfigs').on('created', (cfg: TenantInviteConfig) => {
		rebuildTenantWorker(app, cfg);
	});
	app.service('tenantInviteConfigs').on('patched', (cfg: TenantInviteConfig) => {
		rebuildTenantWorker(app, cfg);
	});
	app.service('tenantInviteConfigs').on('removed', (cfg: TenantInviteConfig) => {
		invalidateSender(cfg.tenantId);
		stopPollerForTenant(cfg.tenantId);
	});
};

export const stopInviteWorkers = (): void => {
	stopAllPollers();
};
