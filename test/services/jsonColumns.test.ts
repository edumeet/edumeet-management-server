import assert from 'assert';
import { app } from '../../src/app';

// Postgres stores these lists as arrays, MySQL as JSON; both must take and return a list.
describe('list columns', () => {
	const internal = { provider: undefined, query: {} };
	const stamp = `lists-${Date.now()}`;

	it('keep a user\'s roles', async () => {
		const created = await app.service('users').create(
			{ email: `${stamp}@example.edu`, password: 'Pw-for-tests-1', roles: [ 'super-admin', 'edumeet-server' ] } as never,
			internal
		);

		try {
			assert.deepStrictEqual(created.roles, [ 'super-admin', 'edumeet-server' ]);

			const patched = await app.service('users').patch(created.id, { roles: [ 'edumeet-server' ] } as never, internal);

			assert.deepStrictEqual(patched.roles, [ 'edumeet-server' ]);

			await app.service('users').patch(created.id, { roles: [] } as never, internal);
			assert.deepStrictEqual((await app.service('users').get(created.id, internal)).roles, []);
		} finally {
			await app.service('users').remove(created.id, internal);
		}
	});

	it('keep a tenant\'s media node regions', async () => {
		const created = await app.service('tenants').create(
			{ name: stamp, description: 'lists', allowedMediaNodeRegions: [ 'eu', 'pl' ] },
			internal
		);

		try {
			assert.deepStrictEqual(created.allowedMediaNodeRegions, [ 'eu', 'pl' ]);

			const patched = await app.service('tenants').patch(created.id, { allowedMediaNodeRegions: [ 'de' ] }, internal);

			assert.deepStrictEqual(patched.allowedMediaNodeRegions, [ 'de' ]);
			assert.deepStrictEqual((await app.service('tenants').get(created.id, internal)).allowedMediaNodeRegions, [ 'de' ]);
		} finally {
			await app.service('tenants').remove(created.id, internal);
		}
	});
});
