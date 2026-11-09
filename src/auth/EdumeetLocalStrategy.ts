import { LocalStrategy } from '@feathersjs/authentication-local';
import type { AuthenticationRequest } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';
import { NotAuthenticated } from '@feathersjs/errors';
import { isKnownPassword, KNOWN_PASSWORD_MESSAGE } from './knownPasswords';

export class EdumeetLocalStrategy extends LocalStrategy {
	// Refuse a publicly known password before looking up the account, for every e-mail
	// address alike, so the answer does not tell whether such an account exists.
	async authenticate(data: AuthenticationRequest, params: Params) {
		if (isKnownPassword(data?.[this.configuration.passwordField])) {
			throw new NotAuthenticated(KNOWN_PASSWORD_MESSAGE);
		}

		return super.authenticate(data, params);
	}
}
