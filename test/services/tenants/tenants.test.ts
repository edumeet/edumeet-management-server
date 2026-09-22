// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert';
import { app } from '../../../src/app';

describe('tenants service', () => {
	it('registered the service', () => {
		const service = app.service('tenants');

		assert.ok(service, 'Registered the service');
	});
});

describe('the language of a tenant', () => {
	const internal = { provider: undefined, query: {} };

	it('is optional, kept as a translation file code, and can be cleared again', async () => {
		const created = await app.service('tenants').create({ name: `locale-${Date.now()}`, description: 'x' }, internal);

		assert.strictEqual(created.locale ?? null, null);

		const polish = await app.service('tenants').patch(created.id, { locale: 'pl' }, internal);

		assert.strictEqual(polish.locale, 'pl');
		assert.strictEqual((await app.service('tenants').get(created.id, internal)).locale, 'pl');

		const cleared = await app.service('tenants').patch(created.id, { locale: null }, internal);

		assert.strictEqual(cleared.locale ?? null, null);

		await assert.rejects(() => app.service('tenants').patch(created.id, { locale: 'Polish' }, internal));
		await assert.rejects(() => app.service('tenants').patch(created.id, { locale: 'PL' }, internal));
		await assert.rejects(() => app.service('tenants').patch(created.id, { locale: 'p' }, internal));

		const regional = await app.service('tenants').patch(created.id, { locale: 'pt-br' }, internal);

		assert.strictEqual(regional.locale, 'pt-br');
		await assert.rejects(() => app.service('tenants').patch(created.id, { locale: 'pl; DROP' }, internal));

		await app.service('tenants').remove(created.id, internal);
	});
});
