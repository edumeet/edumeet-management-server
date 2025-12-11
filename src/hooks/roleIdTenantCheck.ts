import { HookContext } from '../declarations';

export const roleIdTenantCheck = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (context.params.provider && !context.params.user)
		throw new Error('You are not logged in');

	const { roleId } = context.params.data;

	if (roleId) {
		const service = context.app.service('roles');
		const role = await service.get(roleId);

		if (role.tenantId != parseInt(context.params.user.tenantId)) {
			throw new Error('You are not in the same tenant');
		}
	} else {
		throw new Error('Record not found!');
	}
};

export const roleIdTenantCheckOnDelete = async (context: HookContext) => {
	const userValidator = context.service;
	const validationRecord = await userValidator.get(parseInt(context.arguments[0]));

	if (validationRecord) {
		const roleId = validationRecord.roleId;
		const service = context.app.service('roles');
		const role = await service.get(roleId);

		if (role.tenantId != parseInt(context.params.user.tenantId)) {
			throw new Error('You are not in the same tenant!');
		}
	} else {
		throw new Error('Record not found!');
	}

};