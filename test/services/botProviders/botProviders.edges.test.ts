import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';
import { hashBotToken } from '../../../src/bots/verify';
import { decrypt, encrypt } from '../../../src/invites/crypto';

const internal = { provider: undefined, query: {} };
const key = 'b'.repeat(64);

const rawRow = async (id: number | string) =>
	(await app.get('postgresqlClient')('tenantBotCredentials').where({ id })
		.first()) as Record<string, unknown>;

describe('bot providers, the less travelled paths', () => {
	let tenantId: number;
	let otherTenantId: number;
	let previousBots: unknown;
	let counter = 0;

	const base = (label: string) => ({ tenantId, label, tokenHash: hashBotToken(`edge-${Date.now()}-${counter++}`), allowedIps: [ '127.0.0.1' ] });
	const provider = { jobTypes: [ 'recorder' as const ], apiUrl: 'https://rec.example.com', apiSecret: 'acme-key' };
	const find = (id: number, params: Params = internal) => app.service('bot-providers').find({ ...params, query: { tenantId: id } });

	before(async () => {
		previousBots = app.get('bots');
		app.set('bots', { encryptionKey: key });

		tenantId = Number((await app.service('tenants').create({ name: `edges-${Date.now()}`, description: 'x' }, internal)).id);
		otherTenantId = Number((await app.service('tenants').create({ name: `edges-other-${Date.now()}`, description: 'x' }, internal)).id);
		await app.service('tenants').patch(tenantId, { botPolicy: 'tokenOnly' }, internal);
		await app.service('tenants').patch(otherTenantId, { botPolicy: 'all' }, internal);
	});

	after(async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app.set('bots', previousBots as any);
		await app.service('tenants').remove(tenantId, internal);
		await app.service('tenants').remove(otherTenantId, internal);
	});

	describe('what a provider row may hold', () => {
		it('refuses each way of leaving a part out', async () => {
			for (const parts of [ { jobTypes: provider.jobTypes }, { apiUrl: provider.apiUrl }, { apiSecret: provider.apiSecret }, { apiUrl: provider.apiUrl, apiSecret: provider.apiSecret }, { jobTypes: provider.jobTypes, apiSecret: provider.apiSecret } ])
				await assert.rejects(() => app.service('tenantBotCredentials').create({ ...base('Part'), ...parts }, internal), /job type, an API URL and an API key/);
		});

		it('refuses a job type it does not know and an address that is no address', async () => {
			await assert.rejects(() => app.service('tenantBotCredentials').create({ ...base('Dancer'), ...provider, jobTypes: [ 'dancer' ] as never }, internal));
			await assert.rejects(() => app.service('tenantBotCredentials').create({ ...base('No url'), ...provider, apiUrl: 'rec example com' }, internal), /not a valid URL/);
		});

		it('keeps a base path of the address and drops only the trailing slash', async () => {
			const created = await app.service('tenantBotCredentials').create({ ...base('Path'), ...provider, apiUrl: 'https://rec.example.com/edumeet/' }, internal);

			assert.strictEqual(created.apiUrl, 'https://rec.example.com/edumeet');
		});

		it('offers several kinds of job in one row, each once and in a fixed order', async () => {
			const all = await app.service('tenantBotCredentials').create({ ...base('All kinds'), ...provider, jobTypes: [ 'streamer', 'transcriber', 'recorder' ] }, internal);
			const twice = await app.service('tenantBotCredentials').create({ ...base('Twice'), ...provider, jobTypes: [ 'transcriber', 'recorder', 'transcriber' ] }, internal);

			assert.deepStrictEqual(all.jobTypes, [ 'recorder', 'transcriber', 'streamer' ]);
			assert.deepStrictEqual(twice.jobTypes, [ 'recorder', 'transcriber' ]);

			const handed = (await find(tenantId)).find((p) => Number(p.credentialId) === Number(all.id));

			assert.deepStrictEqual(handed?.jobTypes, [ 'recorder', 'transcriber', 'streamer' ]);
			// more entries than there are kinds is not a list anyone meant
			await assert.rejects(() => app.service('tenantBotCredentials').create({ ...base('Four'), ...provider, jobTypes: [ 'recorder', 'recorder', 'streamer', 'transcriber' ] }, internal));
		});

		it('takes an empty list of kinds as no provider at all, and refuses an unknown kind among known ones', async () => {
			const plain = await app.service('tenantBotCredentials').create({ ...base('Empty list'), jobTypes: [] }, internal);

			assert.strictEqual(plain.jobTypes ?? null, null);
			await assert.rejects(() => app.service('tenantBotCredentials').create({ ...base('Half known'), ...provider, jobTypes: [ 'recorder', 'dancer' ] as never }, internal));
		});

		it('treats empty strings from a form like nothing at all', async () => {
			const created = await app.service('tenantBotCredentials').create({ ...base('Empty strings'), apiUrl: '', apiSecret: '' }, internal);

			assert.strictEqual(created.hasApiSecret, false);
			assert.strictEqual(created.apiUrl ?? null, null);
		});
	});

	describe('changing a row', () => {
		it('turns a plain key into a provider, and only with all three parts', async () => {
			const plain = await app.service('tenantBotCredentials').create(base('Becomes a provider'), internal);

			await assert.rejects(() => app.service('tenantBotCredentials').patch(plain.id, { jobTypes: [ 'recorder' ], apiUrl: provider.apiUrl }, internal), /job type, an API URL and an API key/);

			// a copy: the hooks encrypt the key in the object they are given
			const patched = await app.service('tenantBotCredentials').patch(plain.id, { ...provider }, internal);

			assert.deepStrictEqual([ patched.jobTypes, patched.apiUrl, patched.hasApiSecret ], [ [ 'recorder' ], 'https://rec.example.com', true ]);
		});

		it('changes the job type or the address alone and leaves the key as it is', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('One field'), ...provider }, internal);
			const before = (await rawRow(row.id)).apiSecret;

			const retyped = await app.service('tenantBotCredentials').patch(row.id, { jobTypes: [ 'streamer' ] }, internal);
			const moved = await app.service('tenantBotCredentials').patch(row.id, { apiUrl: 'https://live.example.com/' }, internal);

			assert.deepStrictEqual(retyped.jobTypes, [ 'streamer' ]);
			assert.strictEqual(moved.apiUrl, 'https://live.example.com');
			assert.strictEqual((await rawRow(row.id)).apiSecret, before);
		});

		it('refuses to take every kind away from a provider while its address and key stay', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('No kinds left'), ...provider }, internal);

			await assert.rejects(() => app.service('tenantBotCredentials').patch(row.id, { jobTypes: [] }, internal), /job type, an API URL and an API key/);
			assert.deepStrictEqual((await app.service('tenantBotCredentials').get(row.id, internal)).jobTypes, [ 'recorder' ]);
		});

		it('adds a kind to a provider and keeps the rest of it', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('More kinds'), ...provider }, internal);
			const patched = await app.service('tenantBotCredentials').patch(row.id, { jobTypes: [ 'recorder', 'transcriber' ] }, internal);

			assert.deepStrictEqual([ patched.jobTypes, patched.apiUrl, patched.hasApiSecret ], [ [ 'recorder', 'transcriber' ], 'https://rec.example.com', true ]);
		});

		it('validates the address again when only the address changes', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('Bad move'), ...provider }, internal);

			await assert.rejects(() => app.service('tenantBotCredentials').patch(row.id, { apiUrl: 'http://rec.example.com' }, internal), /must use https/);
		});

		it('leaves the provider alone when a patch is about something else', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('Untouched'), ...provider }, internal);
			const patched = await app.service('tenantBotCredentials').patch(row.id, { enabled: false, allowedIps: [ '10.0.0.0/8' ] }, internal);

			assert.deepStrictEqual([ patched.jobTypes, patched.apiUrl, patched.hasApiSecret, patched.enabled ], [ [ 'recorder' ], 'https://rec.example.com', true, false ]);
			assert.strictEqual(decrypt(String((await rawRow(row.id)).apiSecret), key), 'acme-key');
		});

		it('refuses a new key on a patch when the bots key is not configured', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('Rotate without key'), ...provider }, internal);

			app.set('bots', undefined as never);
			await assert.rejects(() => app.service('tenantBotCredentials').patch(row.id, { apiSecret: 'next' }, internal), /bots.encryptionKey is not configured/);
			// a patch that does not touch the key needs no encryption key
			await app.service('tenantBotCredentials').patch(row.id, { label: 'Renamed' }, internal);
			app.set('bots', { encryptionKey: key });
		});

		it('lets a tenant admin set a provider in the own tenant, and not in another', async () => {
			const admin = (over: Record<string, unknown> = {}): Params => ({
				provider: 'rest', authenticated: true, user: { id: 901, tenantId, tenantAdmin: true, roles: [] as string[], ...over }, query: {}
			}) as unknown as Params;
			const created = await app.service('tenantBotCredentials').create({ ...base('Admin provider'), ...provider }, admin());

			assert.strictEqual(created.hasApiSecret, true);
			await assert.rejects(() => app.service('tenantBotCredentials').patch(created.id, { apiSecret: 'stolen' }, admin({ tenantId: otherTenantId })), /same tenant/);
			assert.strictEqual(decrypt(String((await rawRow(created.id)).apiSecret), key), 'acme-key');
		});
	});

	describe('what the room server is handed', () => {
		it('only the rows of the tenant it asks for', async () => {
			await app.service('tenantBotCredentials').create({ ...base('Other tenant'), tenantId: otherTenantId, ...provider, apiSecret: 'other-key' }, internal);

			const mine = await find(tenantId);
			const others = await find(otherTenantId);

			assert.ok(mine.length > 0);
			assert.ok(mine.every((p) => p.apiSecret !== 'other-key'));
			assert.deepStrictEqual(others.map((p) => p.apiSecret), [ 'other-key' ]);
		});

		it('also under the policy that lets any bot in', async () => {
			assert.strictEqual((await find(otherTenantId)).length, 1);
		});

		it('to the room server role, over the API', async () => {
			const asServer = { provider: 'rest', authenticated: true, user: { id: 902, roles: [ 'edumeet-server' ] }, query: {} } as unknown as Params;

			assert.ok((await find(tenantId, asServer)).length > 0);
		});

		it('not to a tenant admin, a plain user or nobody', async () => {
			for (const user of [ { id: 903, tenantId, tenantAdmin: true, roles: [] }, { id: 904, tenantId, roles: [] } ])
				await assert.rejects(() => find(tenantId, { provider: 'rest', authenticated: true, user, query: {} } as unknown as Params));

			await assert.rejects(() => find(tenantId, { provider: 'rest', query: {} } as unknown as Params));
		});

		it('nothing without a tenant id, and nothing for a tenant that does not exist', async () => {
			await assert.rejects(() => app.service('bot-providers').find({ ...internal, query: {} }), /tenantId required/);
			await assert.rejects(() => find(99999999));
		});

		it('nothing when the bots key is not configured', async () => {
			app.set('bots', undefined as never);
			assert.deepStrictEqual(await find(tenantId), []);
			app.set('bots', { encryptionKey: key });
		});

		it('no row whose stored kinds cannot be read any more', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('Old kinds'), ...provider }, internal);

			await app.get('postgresqlClient')('tenantBotCredentials').where({ id: row.id })
				.update({ jobTypes: '["dancer"]' });

			assert.strictEqual((await find(tenantId)).some((p) => Number(p.credentialId) === Number(row.id)), false);
		});

		it('every row but one whose key cannot be read any more', async () => {
			const row = await app.service('tenantBotCredentials').create({ ...base('Old key'), ...provider }, internal);

			await app.get('postgresqlClient')('tenantBotCredentials').where({ id: row.id })
				.update({ apiSecret: encrypt('acme-key', 'c'.repeat(64)) });

			const found = await find(tenantId);

			assert.strictEqual(found.some((p) => Number(p.credentialId) === Number(row.id)), false);
			assert.ok(found.length > 0);
		});
	});

	describe('what a verified token says about its row', () => {
		it('names no job type for a plain key', async () => {
			const token = `plain-${Date.now()}`;

			await app.service('tenantBotCredentials').create({ ...base('Plain verify'), tokenHash: hashBotToken(token) }, internal);

			const verdict = await app.service('bot-verify').create({ tenantId, botToken: token, address: '127.0.0.1' }, internal);

			assert.ok(verdict.allowed && verdict.verified);
			assert.strictEqual('jobTypes' in verdict, false);
		});
	});

	describe('the key it is encrypted with', () => {
		it('is named in the error when it is malformed', () => {
			assert.throws(() => encrypt('x', 'short', 'bots.encryptionKey'), /bots.encryptionKey must be a 32-byte/);
			assert.throws(() => encrypt('x', 'short'), /invites.encryptionKey must be a 32-byte/);
		});
	});
});
