import { LocalStrategy } from '@feathersjs/authentication-local';
import type { AuthenticationRequest } from '@feathersjs/authentication';
import type { Params } from '@feathersjs/feathers';
import { NotAuthenticated } from '@feathersjs/errors';
import { isKnownPassword, KNOWN_PASSWORD_MESSAGE } from './knownPasswords';

// More rows than one address has in practice: it is unique per tenant, and few tenants share one.
const MAX_ACCOUNTS_PER_EMAIL = 50;

type Account = Record<string, unknown>;

export class EdumeetLocalStrategy extends LocalStrategy {
	// An e-mail address is unique per tenant only, and the stock lookup took an arbitrary first
	// row. A passwordless SSO account in some tenant, created by an identity provider that asserts
	// a local account's address, could then lock that account (the super admin, the room server's
	// service account) out of password login. All rows with the address are looked at instead.
	async getEntityQuery(query: Record<string, unknown>, _params: Params) {
		return { ...query, $sort: { id: 1 }, $limit: MAX_ACCOUNTS_PER_EMAIL };
	}

	// Refuse a publicly known password before looking up the account, for every e-mail
	// address alike, so the answer does not tell whether such an account exists.
	async authenticate(data: AuthenticationRequest, params: Params) {
		const { passwordField, usernameField, entity, errorMessage } = this.configuration;
		const username = data?.[usernameField];
		const password = data?.[passwordField];

		if (isKnownPassword(password)) throw new NotAuthenticated(KNOWN_PASSWORD_MESSAGE);
		if (!password || typeof password !== 'string') throw new NotAuthenticated(errorMessage);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { provider, ...paramsWithoutProvider } = params;
		const accounts = await this.findAccounts(username, paramsWithoutProvider);
		let match: Account | undefined;

		// Only accounts with a password take part, oldest first; whoever knows the password of
		// two of them may use either, so the first that accepts it is signed in.
		for (const account of accounts.filter((a) => Boolean(a[this.configuration.entityPasswordField]))) {
			try {
				match = await this.comparePassword(account, password);
				break;
			} catch {
				// Not this one.
			}
		}

		if (!match) throw new NotAuthenticated(errorMessage);

		return {
			authentication: { strategy: this.name as string },
			[entity]: await this.getEntity(match, params)
		};
	}

	private async findAccounts(username: unknown, params: Params): Promise<Account[]> {
		// A query object ({ $ne: '' }) would make one login try the password on many accounts.
		if (!username || typeof username !== 'string') throw new NotAuthenticated(this.configuration.errorMessage);

		const query = await this.getEntityQuery({ [this.configuration.entityUsernameField]: username }, params);
		const result = await this.entityService.find({ ...params, query });

		return (Array.isArray(result) ? result : result.data) as Account[];
	}
}
