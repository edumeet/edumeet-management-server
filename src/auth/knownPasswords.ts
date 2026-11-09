// Passwords published in this repository and in edumeet-docker: the initial migration seeds
// the super-admin with "supersecret", and edumeet-docker's password-change migration sets
// "supersecret2" when utils/run-me-first.sh has not replaced it. They must never work.
const KNOWN_PASSWORDS = new Set([ 'supersecret', 'supersecret2' ]);

export const isKnownPassword = (password: unknown): boolean =>
	typeof password === 'string' && KNOWN_PASSWORDS.has(password);

export const KNOWN_PASSWORD_MESSAGE =
	'This password is publicly known and can no longer be used. ' +
	'An operator can set a new one with: yarn set-password <email>';
