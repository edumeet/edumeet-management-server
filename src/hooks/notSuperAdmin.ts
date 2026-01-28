import { HookContext } from '../declarations';

export const notSuperAdmin = () => (context: HookContext) => {
	if (!context.params.provider) return false;

	if (!context.params.user || !context.params.user.roles) return true;

	if (typeof context.params.user.roles=='string') {
		const j = JSON.parse(context.params.user.roles);

		if (j)
			if (typeof j.some == 'undefined') {
				return true;
			} else {
				return !j.some((role: string) => role === 'super-admin' || role === 'edumeet-server');	
			}
	}
	if (typeof context.params.user.roles.some == 'undefined') {
		return true;
	} else {
		return !context.params.user.roles.some((role: string) => role === 'super-admin' || role === 'edumeet-server');
	}
	
};