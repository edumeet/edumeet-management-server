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

		// numberLimit is super-admin only — tenant admins cannot change the tenant-wide room cap
		delete context.data['numberLimit'];

		// tenant admins cannot move their default to another tenant — the row's
		// tenant is fixed at creation, so never let a patched tenantId through
		delete context.data['tenantId'];

		if (item['managerManagedRoomNumberLimit'] && typeof item['managerManagedRoomNumberLimit'] == 'string') {
			context.data['managerManagedRoomNumberLimit'] = parseInt(String(item['managerManagedRoomNumberLimit']));
		}
		if (context.data['managerManagedRoomNumberLimit']==null) {
			delete context.data['managerManagedRoomNumberLimit'];
		}

		// These values come straight from the DB. On MySQL a boolean column is a
		// TINYINT(1) that reads back as 0/1, which would fail the strict boolean
		// schema, so coerce with Boolean() (a no-op on Postgres' native boolean).
		if (item['disableUnmanagedLock']) {
			context.data['disableUnmanaged'] = Boolean(item['disableUnmanaged']);
		}
		if (item['endToEndEncryptionLock']) {
			context.data['endToEndEncryption'] = Boolean(item['endToEndEncryption']);
		}
		if (item['lockedLock']) {
			context.data['lockedUnmanaged'] = Boolean(item['lockedUnmanaged']);
		}
		if (item['raiseHandEnabledLock']) {
			context.data['raiseHandEnabledUnmanaged'] = Boolean(item['raiseHandEnabledUnmanaged']);
		}
		if (item['localRecordingEnabledLock']) {
			context.data['localRecordingEnabledUnmanaged'] = Boolean(item['localRecordingEnabledUnmanaged']);
		}
		if (item['chatEnabledLock']) {
			context.data['chatEnabledUnmanaged'] = Boolean(item['chatEnabledUnmanaged']);
		}
		if (item['breakoutsEnabledLock']) {
			context.data['breakoutsEnabledUnmanaged'] = Boolean(item['breakoutsEnabledUnmanaged']);
		}
		if (item['filesharingEnabledLock']) {
			context.data['filesharingEnabledUnmanaged'] = Boolean(item['filesharingEnabledUnmanaged']);
		}
		
	}

};
