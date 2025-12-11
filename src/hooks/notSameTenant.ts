import { HookContext } from '../declarations';

export const notInSameTenant = (context: HookContext) => {
	if (parseInt(context.data.tenantId) !== parseInt(context.params.user.tenantId))
		throw new Error('You are not in the same tenant');
};
export const notInSameTenantByContextId = async (context: HookContext) => {
	const userValidator = context.service;
	const validationRecord = await userValidator.get(parseInt(context.arguments[0]));

	if (validationRecord) {
		// TODO context.params.user.id (creator id could be an additional check)
		if (parseInt(validationRecord.tenantId) != parseInt(context.params.user.tenantId))
			throw new Error('You are not in the same tenant');
	} else {
		throw new Error('Record not found!');
	}
};
