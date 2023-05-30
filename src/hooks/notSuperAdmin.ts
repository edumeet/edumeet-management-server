import { HookContext } from '../declarations';

export const notSuperAdmin = () => (context: HookContext) => {
	if (!context.params.provider) return false;

	if (!context.params.user || !context.params.user.roles) return true;

	return !context.params.user.roles.some((role: string) => role === 'super-admin' || role === 'server-admin');
};