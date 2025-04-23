import { HookContext } from '../declarations';

export const adminOnlyData = async (context: HookContext): Promise<void> => {
	if (context.params.provider) {

		if (context.data.action == 'superAdmin') {
			throw new Error('This action is only allowed for administrators');
		}
	}

};