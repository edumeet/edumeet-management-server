import { HookContext } from '../declarations';

export const adminOnly = async (context: HookContext): Promise<void> => {
	if (context.params.provider) {
		throw new Error('This action is only allowed for administrators');
	}

};