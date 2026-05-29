import { authenticate } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';
import { iff } from 'feathers-hooks-common';

import type { Application } from '../../declarations';
import { isTenantAdmin } from '../../hooks/isTenantAdmin';
import { notSuperAdmin } from '../../hooks/notSuperAdmin';

const inviteServerStatusPath = 'invite-server-status';

// Read-only flag the client uses to warn admins when the deployment is missing the
// server-side invite secrets. Booleans only — the secrets themselves are never exposed.
export interface InviteServerStatus {
	encryptionKey: boolean;
	rsvpTokenSecret: boolean;
	configured: boolean;
}

declare module '../../declarations' {
	interface ServiceTypes {
		// eslint-disable-next-line no-unused-vars
		[inviteServerStatusPath]: { find(_params?: Params): Promise<InviteServerStatus> };
	}
}

export const inviteServerStatus = (app: Application) => {
	app.use(inviteServerStatusPath, {
		async find(): Promise<InviteServerStatus> {
			const invites = app.get('invites');
			const encryptionKey = Boolean(invites?.encryptionKey);
			const rsvpTokenSecret = Boolean(invites?.rsvpTokenSecret);

			return { encryptionKey, rsvpTokenSecret, configured: encryptionKey && rsvpTokenSecret };
		}
	}, { methods: [ 'find' ], events: [] });

	app.service(inviteServerStatusPath).hooks({
		around: {
			all: [ authenticate('jwt') ]
		},
		before: {
			all: [ iff(notSuperAdmin(), isTenantAdmin) ]
		}
	});
};
