// Set a user's password from the server's command line, for example for the initial
// super-admin whose published password can no longer be used to sign in:
//
//   yarn set-password edumeet-admin@localhost
//   docker compose exec -it edumeet-management-server yarn set-password edumeet-admin@localhost
//
// The new password is read from standard input, so it does not end up in the shell history.
import readline from 'readline';
import { app } from '../app';
import { isKnownPassword } from '../auth/knownPasswords';

const MIN_LENGTH = 12;

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
	const email = process.argv[2];

	if (!email) throw new Error('Usage: yarn set-password <email>');

	const users = app.service('users');
	const found = await users.find({ query: { email, $limit: 2 }, paginate: false, provider: undefined });

	if (found.length !== 1) throw new Error(found.length ? `More than one user has the e-mail ${email} (one per tenant); not changing any` : `No user with the e-mail ${email}`);

	const password = await readPassword();

	if (password.length < MIN_LENGTH) throw new Error(`The password must have at least ${MIN_LENGTH} characters`);
	if (isKnownPassword(password)) throw new Error('This password is publicly known');

	// The users service hashes the password (passwordHash resolver).
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await users.patch(found[0].id, { password } as any, { provider: undefined });

	process.stdout.write(`Password changed for ${email}\n`);
};

main()
	.then(() => app.get('postgresqlClient').destroy())
	.catch(async (error) => {
		process.stderr.write(`${(error as Error).message}\n`);
		await app.get('postgresqlClient').destroy();
		process.exitCode = 1;
	});
