// For more information about this file see https://dove.feathersjs.com/guides/cli/app.test.html
import assert from 'assert';
import axios from 'axios';
import type { Server } from 'http';
import { app } from '../src/app';

const port = app.get('port');
const appUrl = `http://${app.get('host')}:${port}`;

describe('Feathers application tests', () => {
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	let server: Server;

	before(async () => {
		server = await app.listen(port);
	});

	after(async () => {
		await app.teardown();
	});

	it('starts and shows the index page', async () => {
		const { data } = await axios.get<string>(appUrl);

		assert.ok(data.indexOf('<html lang="en">') !== -1);
	});

	it('shows a 404 JSON error', async () => {
		try {
			await axios.get(`${appUrl}/path/to/nowhere`, {
				responseType: 'json'
			});
			assert.fail('should never get here');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			const { response } = error;

			assert.strictEqual(response?.status, 404);
			assert.strictEqual(response?.data?.code, 404);
			assert.strictEqual(response?.data?.name, 'NotFound');
		}
	});
});
