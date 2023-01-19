// For more information about this file see https://dove.feathersjs.com/guides/cli/client.test.html
import assert from 'assert';
import axios from 'axios';

import rest from '@feathersjs/rest-client';
import { app } from '../src/app';
import { createClient } from '../src/client';
import type { UserData } from '../src/client';

const port = app.get('port');
const appUrl = `http://${app.get('host')}:${port}`;

describe('application client tests', () => {
	const client = createClient(rest(appUrl).axios(axios));

	before(async () => {
		await app.listen(port);
	});

	after(async () => {
		await app.teardown();
	});

	it('initialized the client', () => {
		assert.ok(client);
	});

	it('creates and authenticates a user with email and password', async () => {
		const organizationData = {
			name: 'Test Organization',
			description: 'Test organization for testing',
		};

		// Need to create an organization first, and can't use the client to do it because it's not authenticated
		const organization = await app.service('organizations').create(organizationData);

		const userData: UserData = {
			email: 'someone@example.com',
			password: 'supersecret',
		};

		await client.service('users').create(userData);

		const { user, accessToken } = await client.authenticate({
			strategy: 'local',
			email: userData.email,
			password: userData.password,
		});

		assert.ok(accessToken, 'Created access token for user');
		assert.ok(user, 'Includes user in authentication data');
		assert.strictEqual(user.password, undefined, 'Password is hidden to clients');

		await client.logout();

		// Remove the test organization. This will also remove the user.
		await app.service('organizations').remove(organization.id);
		// await app.service('users').remove(user.id);
	});
});
