import { HookContext } from '../declarations';

export const notInSameTenant = (context: HookContext) => {
	if (context.data.tenantId !== context.params.user.tenantId)
		throw new Error('You are not in the same tenant');
};
