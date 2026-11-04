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

describe('the bot jobs a room of a tenant may run', () => {
	const internal = { provider: undefined, query: {} };

	it('is optional, a whole number from 1 to 100, and can be cleared again', async () => {
		const created = await app.service('tenants').create({ name: `bot-jobs-${Date.now()}`, description: 'x' }, internal);

		assert.strictEqual(created.maxBotJobsPerRoom ?? null, null);

		const set = await app.service('tenants').patch(created.id, { maxBotJobsPerRoom: 25 }, internal);

		assert.strictEqual(Number(set.maxBotJobsPerRoom), 25);
		assert.strictEqual(Number((await app.service('tenants').get(created.id, internal)).maxBotJobsPerRoom), 25);

		for (const bad of [ 0, -1, 101, 2.5 ])
			await assert.rejects(() => app.service('tenants').patch(created.id, { maxBotJobsPerRoom: bad }, internal));

		assert.strictEqual(Number((await app.service('tenants').get(created.id, internal)).maxBotJobsPerRoom), 25);

		const cleared = await app.service('tenants').patch(created.id, { maxBotJobsPerRoom: null }, internal);

		assert.strictEqual(cleared.maxBotJobsPerRoom ?? null, null);

		await app.service('tenants').remove(created.id, internal);
	});

	it('is taken when the tenant is created, and refused there out of range or as text', async () => {
		const created = await app.service('tenants').create({ name: `bot-jobs-new-${Date.now()}`, description: 'x', maxBotJobsPerRoom: 12 }, internal);

		assert.strictEqual(Number((await app.service('tenants').get(created.id, internal)).maxBotJobsPerRoom), 12);
		await app.service('tenants').remove(created.id, internal);

		await assert.rejects(() => app.service('tenants').create({ name: `bot-jobs-bad-${Date.now()}`, description: 'x', maxBotJobsPerRoom: 101 }, internal));
		await assert.rejects(() => app.service('tenants').create({ name: `bot-jobs-text-${Date.now()}`, description: 'x', maxBotJobsPerRoom: '12' as unknown as number }, internal));
	});
});
