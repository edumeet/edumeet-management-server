import { HookContext } from '../declarations';
import { strictId } from './strictId';

export const roleIdTenantCheck = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (context.params.provider && !context.params.user)
		throw new Error('You are not logged in');

	const roleId = context.data.roleId;

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
	// The row that is checked here is the row the database then removes: the same id, in
	// the one form every database reads alike.
	context.id = strictId(context.id);

	const userValidator = context.service;
	const validationRecord = await userValidator.get(context.id);

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