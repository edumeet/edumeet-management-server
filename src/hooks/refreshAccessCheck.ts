import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import type { Application, HookContext } from '../declarations';
import { logger } from '../logger';
import { isAccessPermitted } from './accessDecision';

export const DEFAULT_AUTH_SESSION_MAX_DAYS = 30;

export const sessionMaxAgeSeconds = (app: Application): number => {
	const days = app.get('authSessionMaxDays');

	return Math.round((typeof days === 'number' && days > 0 ? days : DEFAULT_AUTH_SESSION_MAX_DAYS) * 24 * 60 * 60);
};

export const refreshAccessCheck = async (context: HookContext): Promise<HookContext> => {
	const { app, params } = context;
	const { user } = params;
	const authTime = params.authentication?.payload?.auth_time;
	const now = Math.floor(Date.now() / 1000);

	if (!user) throw new NotAuthenticated('Not authenticated');

	if (typeof authTime !== 'number' || now - authTime > sessionMaxAgeSeconds(app)) {
		logger.info('token-refresh: session of user %s has passed its maximum age, sign in required', user.id);

		throw new NotAuthenticated('Session expired, sign in again');
	}

	if (user.tenantId === undefined || user.tenantId === null || !user.ssoId) return context;

	const tenantId = parseInt(String(user.tenantId));
	const permitted = await isAccessPermitted(
		app,
		tenantId,
		{ ssoId: user.ssoId, email: user.email, name: user.name, tenantId },
		'accessRules(refresh)',
		user
	);

	if (!permitted) throw new Forbidden('Action not allowed by rule');

	return context;
};
