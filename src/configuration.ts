import { Type, getValidator, defaultAppConfiguration } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import { dataValidator } from './validators';

export const inviteConfigSchema = Type.Object({
	encryptionKey: Type.String(),
	rsvpTokenSecret: Type.String(),
	imapPollIntervalMs: Type.Optional(Type.Number())
});

export const configurationSchema = Type.Intersect([
	defaultAppConfiguration,
	Type.Object({
		host: Type.String(),
		port: Type.Number(),
		public: Type.String(),
		invites: Type.Optional(inviteConfigSchema)
	})
]);

export type ApplicationConfiguration = Static<typeof configurationSchema>

export const configurationValidator = getValidator(configurationSchema, dataValidator);
