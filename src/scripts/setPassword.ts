// Set a user's password from the server's command line, for example for the initial
// super-admin whose published password can no longer be used to sign in:
//
//   yarn set-password edumeet-admin@localhost
//   docker compose exec -it edumeet-management-server yarn set-password edumeet-admin@localhost
//
// The new password is read from standard input, so it does not end up in the shell history.
//
// An address is unique per tenant only. Without a tenant, the account that belongs to no tenant
// is meant (the super admin, the room servers' account), whatever accounts tenants have under
// the same address: a tenant must not be able to block this tool by creating one. For the
// account of a tenant, give the tenant's id:
//
//   yarn set-password someone@example.edu 3
import readline from 'readline';
import { app } from '../app';
import { isKnownPassword } from '../auth/knownPasswords';

const MIN_LENGTH = 12;
// More rows than one address has in practice, as in EdumeetLocalStrategy.
const MAX_ACCOUNTS_PER_EMAIL = 50;

type Account = { id: number | string; tenantId?: number | string | null };

// The account the operator means, or an error that says how to name it.
const chooseAccount = (accounts: Account[], email: string, tenant?: string): Account => {
	const ofNoTenant = accounts.filter((account) => account.tenantId === null || account.tenantId === undefined);
	const wanted = tenant === undefined
		? (ofNoTenant.length ? ofNoTenant : accounts)
		: accounts.filter((account) => String(account.tenantId ?? '') === tenant);

	if (wanted.length === 1) return wanted[0];

	if (wanted.length === 0)
		throw new Error(tenant === undefined ? `No user with the e-mail ${email}` : `No user with the e-mail ${email} in tenant ${tenant}`);

	const tenants = wanted.map((account) => account.tenantId ?? 'none').join(', ');

	throw new Error(`More than one user has the e-mail ${email} (tenants: ${tenants}); not changing any. Name the tenant: yarn set-password ${email} <tenantId>`);
};

const readPassword = async (): Promise<string> => {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });

	if (process.stdin.isTTY) {
		// Don't echo what is typed.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(rl as any)._writeToOutput = () => undefined;
		process.stdout.write('New password: ');
	}

	const line = await new Promise<string>((resolve) => rl.once('line', resolve));

	rl.close();
	if (process.stdin.isTTY) process.stdout.write('\n');

	return line;
};

const main = async () => {
	const [ email, tenant ] = process.argv.slice(2);

	if (!email) throw new Error('Usage: yarn set-password <email> [tenantId]');

	const users = app.service('users');
	const found = await users.find({ query: { email, $sort: { id: 1 }, $limit: MAX_ACCOUNTS_PER_EMAIL }, paginate: false, provider: undefined });
	const account = chooseAccount(found as Account[], email, tenant);

	const password = await readPassword();

	if (password.length < MIN_LENGTH) throw new Error(`The password must have at least ${MIN_LENGTH} characters`);
	if (isKnownPassword(password)) throw new Error('This password is publicly known');

	// The users service hashes the password (passwordHash resolver).
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await users.patch(account.id as any, { password } as any, { provider: undefined });

	process.stdout.write(`Password changed for ${email} (${account.tenantId == null ? 'no tenant' : `tenant ${account.tenantId}`})\n`);
};

main()
	.then(() => app.get('postgresqlClient').destroy())
	.catch(async (error) => {
		process.stderr.write(`${(error as Error).message}\n`);
		await app.get('postgresqlClient').destroy();
		process.exitCode = 1;
	});
