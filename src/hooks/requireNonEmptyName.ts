import type { HookContext } from '../declarations';
import { BadRequest } from '@feathersjs/errors';

export const requireNonEmptyName = async (context: HookContext): Promise<HookContext> => {
	if (context.data && Object.prototype.hasOwnProperty.call(context.data, 'name')) {
		const n = String(context.data.name ?? '').trim();

		if (n.length === 0) {
			throw new BadRequest('Name is required');
		}

		context.data.name = n;
	}

	return context;
};
