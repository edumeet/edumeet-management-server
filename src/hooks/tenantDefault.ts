import { HookContext } from '../declarations';

export const tenantDefault = async (context: HookContext): Promise<void> => {
	// If the user is not logged in, throw an error.
	if (context.params.provider && !context.params.user)
		throw new Error('You are not logged in');

	const originalid = context.id;
	const defaultsService = context.app.service('defaults');

	// user is tenant admin, but if parameter is locked by the super administrator we ignore the changes
	if (originalid) {
		const item = await defaultsService.get(originalid);

		if (item['managerManagedRoomNumberLimit'] && typeof item['managerManagedRoomNumberLimit'] == 'string') {
			context.data['managerManagedRoomNumberLimit'] = parseInt(String(item['managerManagedRoomNumberLimit']));
		}
		if (context.data['managerManagedRoomNumberLimit']==null) {
			delete context.data['managerManagedRoomNumberLimit'];
		}

		if (item['lockedLock']) {
			context.data['lockedUnmanaged'] = item['lockedUnmanaged'];
		}
		if (item['raiseHandEnabledLock']) {
			context.data['raiseHandEnabledUnmanaged'] = item['raiseHandEnabledUnmanaged'];
		}
		if (item['localRecordingEnabledLock']) {
			context.data['localRecordingEnabledUnmanaged'] = item['localRecordingEnabledUnmanaged'];
		}
		if (item['chatEnabledLock']) {
			context.data['chatEnabledUnmanaged'] = item['chatEnabledUnmanaged'];
		}
		if (item['breakoutsEnabledLock']) {
			context.data['breakoutsEnabledUnmanaged'] = item['breakoutsEnabledUnmanaged'];
		}
		if (item['filesharingEnabledLock']) {
			context.data['filesharingEnabledUnmanaged'] = item['filesharingEnabledUnmanaged'];
		}
		
	}

};
