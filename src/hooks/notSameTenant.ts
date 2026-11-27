import { HookContext } from '../declarations';
import { strictId } from './strictId';

export const notInSameTenantByContextId = async (context: HookContext) => {
	// The row that is checked here is the row the database then acts on: the same id, in
	// the one form every database reads alike.
	context.id = strictId(context.id);

	const userValidator = context.service;
	const validationRecord = await userValidator.get(context.id);

	if (validationRecord) {
		// TODO context.params.user.id (creator id could be an additional check)
		if (parseInt(validationRecord.tenantId) != parseInt(context.params.user.tenantId))
			throw new Error('You are not in the same tenant');
	} else {
		throw new Error('Record not found!');
	}
};
