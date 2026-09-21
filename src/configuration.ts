import { Type, getValidator, defaultAppConfiguration } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';

import { dataValidator } from './validators';

// All fields optional so a missing or partial invites block never blocks server startup.
// Runtime guard in invites/registry.ts disables the feature with a warning log when
// encryptionKey or rsvpTokenSecret is missing, rather than crashing the process.
export const inviteConfigSchema = Type.Object({
	encryptionKey: Type.Optional(Type.String()),
	rsvpTokenSecret: Type.Optional(Type.String()),
	imapPollIntervalMs: Type.Optional(Type.Number()),
	imapPollBootDelayMs: Type.Optional(Type.Number()),
	imapRetentionDays: Type.Optional(Type.Number())
});

// Kept apart from the invites key so either can be rotated on its own.
export const botConfigSchema = Type.Object({
	encryptionKey: Type.Optional(Type.String())
});

export const configurationSchema = Type.Intersect([
	defaultAppConfiguration,
	Type.Object({
		host: Type.String(),
		port: Type.Number(),
		public: Type.String(),
		authSessionMaxDays: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
		invites: Type.Optional(inviteConfigSchema),
		bots: Type.Optional(botConfigSchema)
	})
]);

export type ApplicationConfiguration = Static<typeof configurationSchema>

export const configurationValidator = getValidator(configurationSchema, dataValidator);
