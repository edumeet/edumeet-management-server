import assert from 'assert';
import { app } from '../../../src/app';
import { hashBotToken } from '../../../src/bots/verify';
import { decrypt } from '../../../src/invites/crypto';
import { tenantBotCredentialExternalResolver } from '../../../src/services/tenantBotCredentials/tenantBotCredentials.schema';
import type { HookContext } from '../../../src/declarations';

const internal = { provider: undefined, query: {} };
const key = 'a'.repeat(64);

const rawRow = async (id: number | string) =>
	(await app.get('postgresqlClient')('tenantBotCredentials').where({ id })
		.first()) as Record<string, unknown>;

describe('bot providers', () => {
	let tenantId: number;
	let previousBots: unknown;

	before(async () => {
		previousBots = app.get('bots');
		app.set('bots', { encryptionKey: key });

		const tenant = await app.service('tenants').create({ name: `providers-${Date.now()}`, description: 'bot providers test' }, internal);

		tenantId = Number(tenant.id);
		await app.service('tenants').patch(tenantId, { botPolicy: 'tokenOnly' }, internal);
	});

	after(async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app.set('bots', previousBots as any);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	it('registered the service', () => {
		assert.ok(app.service('bot-providers'), 'Registered the service');
	});

	it('keeps a row without any provider fields as a plain bot key', async () => {
		const created = await app.service('tenantBotCredentials').create({
			tenantId, label: 'Plain key', tokenHash: hashBotToken(`plain-${Date.now()}`), allowedIps: [ '10.0.0.0/8' ]
		}, internal);

		assert.strictEqual(created.hasApiSecret, false);
		assert.strictEqual(created.apiUrl ?? null, null);
		assert.strictEqual(created.jobTypes ?? null, null);
	});

	it('refuses a provider that is missing one of the three fields', async () => {
		await assert.rejects(() => app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Half',
			tokenHash: hashBotToken(`half-${Date.now()}`),
			allowedIps: [ '10.0.0.0/8' ],
			jobTypes: [ 'recorder' ],
			apiUrl: 'https://rec.example.com'
		}, internal), /job type, an API URL and an API key/);
	});

	it('refuses an api url that is not https', async () => {
		await assert.rejects(() => app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Plain http',
			tokenHash: hashBotToken(`http-${Date.now()}`),
			allowedIps: [ '10.0.0.0/8' ],
			jobTypes: [ 'recorder' ],
			apiUrl: 'http://rec.example.com',
			apiSecret: 'acme-key'
		}, internal), /must use https/);
	});

	it('refuses an api url the room server could not append a path to, and a key that is not header text', async () => {
		const base = { tenantId, label: 'Odd', allowedIps: [ '10.0.0.0/8' ], jobTypes: [ 'recorder' as const ], apiSecret: 'acme-key' };

		for (const apiUrl of [ 'https://rec.example.com/?tenant=1', 'https://rec.example.com/#jobs', 'https://user:pass@rec.example.com' ]) {
			await assert.rejects(() => app.service('tenantBotCredentials').create({
				...base,
				tokenHash: hashBotToken(`odd-${apiUrl}`),
				apiUrl
			}, internal), /must not carry a query, a fragment or a login/);
		}

		await assert.rejects(() => app.service('tenantBotCredentials').create({
			...base,
			tokenHash: hashBotToken('odd-key'),
			apiUrl: 'https://rec.example.com',
			apiSecret: [ 'two', 'lines' ].join(String.fromCharCode(10))
		}, internal), /printable characters/);
	});

	it('stores the api key encrypted and never returns it to a client', async () => {
		const created = await app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Acme Recorder',
			tokenHash: hashBotToken(`acme-${Date.now()}`),
			allowedIps: [ '127.0.0.1' ],
			jobTypes: [ 'recorder' ],
			apiUrl: 'https://rec.example.com/',
			apiSecret: 'acme-live-key'
		}, internal);

		assert.deepStrictEqual(created.jobTypes, [ 'recorder' ]);
		assert.strictEqual(created.apiUrl, 'https://rec.example.com');
		assert.strictEqual(created.hasApiSecret, true);

		const stored = await rawRow(created.id);

		assert.notStrictEqual(stored.apiSecret, 'acme-live-key');
		assert.strictEqual(decrypt(String(stored.apiSecret), key, 'bots.encryptionKey'), 'acme-live-key');

		// resolveExternal shapes what goes out on the wire, so the resolver is asked directly.
		const row = await app.service('tenantBotCredentials').get(created.id, internal);
		const sent = await tenantBotCredentialExternalResolver.resolve(row, { params: { provider: 'rest' }, app } as unknown as HookContext);

		assert.strictEqual((sent as { apiSecret?: string }).apiSecret, undefined);
		assert.strictEqual((sent as { tokenHash?: string }).tokenHash, undefined);
		assert.strictEqual(sent.hasApiSecret, true);
		assert.strictEqual(sent.apiUrl, 'https://rec.example.com');

		await app.service('tenantBotCredentials').remove(created.id, internal);
	});

	it('keeps the stored key when a patch leaves it empty, and clears everything with the url', async () => {
		const created = await app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Acme Live',
			tokenHash: hashBotToken(`live-${Date.now()}`),
			allowedIps: [ '127.0.0.1' ],
			jobTypes: [ 'streamer' ],
			apiUrl: 'https://live.example.com',
			apiSecret: 'first-key'
		}, internal);

		const renamed = await app.service('tenantBotCredentials').patch(created.id, { label: 'Acme Live 2', apiSecret: '' }, internal);

		assert.strictEqual(renamed.label, 'Acme Live 2');
		assert.strictEqual(renamed.hasApiSecret, true);
		assert.strictEqual(decrypt(String((await rawRow(created.id)).apiSecret), key, 'bots.encryptionKey'), 'first-key');

		const rotated = await app.service('tenantBotCredentials').patch(created.id, { apiSecret: 'second-key' }, internal);

		assert.strictEqual(rotated.hasApiSecret, true);
		assert.strictEqual(decrypt(String((await rawRow(created.id)).apiSecret), key, 'bots.encryptionKey'), 'second-key');

		const cleared = await app.service('tenantBotCredentials').patch(created.id, { apiUrl: '' }, internal);

		assert.strictEqual(cleared.hasApiSecret, false);
		assert.strictEqual(cleared.apiUrl, null);
		assert.strictEqual(cleared.jobTypes, null);

		await app.service('tenantBotCredentials').remove(created.id, internal);
	});

	it('refuses to store an api key when the bots key is not configured', async () => {
		app.set('bots', undefined as never);

		await assert.rejects(() => app.service('tenantBotCredentials').create({
			tenantId,
			label: 'No key',
			tokenHash: hashBotToken(`nokey-${Date.now()}`),
			allowedIps: [ '127.0.0.1' ],
			jobTypes: [ 'recorder' ],
			apiUrl: 'https://rec.example.com',
			apiSecret: 'acme-live-key'
		}, internal), /bots.encryptionKey is not configured/);

		app.set('bots', { encryptionKey: key });
	});

	it('hands the room server the providers of a tenant with the key decrypted', async () => {
		const provider = await app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Acme Recorder',
			tokenHash: hashBotToken(`find-${Date.now()}`),
			allowedIps: [ '127.0.0.1' ],
			jobTypes: [ 'recorder' ],
			apiUrl: 'https://rec.example.com',
			apiSecret: 'acme-live-key'
		}, internal);

		const found = await app.service('bot-providers').find({ ...internal, query: { tenantId } });
		const row = found.find((p) => Number(p.credentialId) === Number(provider.id));

		assert.ok(row, 'the provider is in the list');
		assert.deepStrictEqual(row?.jobTypes, [ 'recorder' ]);
		assert.strictEqual(row?.apiUrl, 'https://rec.example.com');
		assert.strictEqual(row?.apiSecret, 'acme-live-key');
		assert.strictEqual(row?.label, 'Acme Recorder');

		// rows that are only a bot key are not providers
		assert.ok(found.every((p) => p.apiUrl && p.apiSecret));

		const disabled = await app.service('tenantBotCredentials').patch(provider.id, { enabled: false }, internal);

		assert.strictEqual(disabled.enabled, false);
		assert.strictEqual((await app.service('bot-providers').find({ ...internal, query: { tenantId } }))
			.some((p) => Number(p.credentialId) === Number(provider.id)), false);

		await app.service('tenantBotCredentials').patch(provider.id, { enabled: true }, internal);
	});

	it('hands out nothing while the tenant has bots disabled', async () => {
		await app.service('tenants').patch(tenantId, { botPolicy: 'disabled' }, internal);
		assert.deepStrictEqual(await app.service('bot-providers').find({ ...internal, query: { tenantId } }), []);
		await app.service('tenants').patch(tenantId, { botPolicy: 'tokenOnly' }, internal);
	});

	it('is closed to everyone but the room server and a super admin', async () => {
		await assert.rejects(() => app.service('bot-providers').find({
			provider: 'rest', authenticated: true, user: { roles: [ 'tenant-admin' ], tenantId }, query: { tenantId }
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any));
	});

	it('tells the room server which credential and job types a token belongs to', async () => {
		const token = `verify-${Date.now()}`;
		const credential = await app.service('tenantBotCredentials').create({
			tenantId,
			label: 'Acme Transcriber',
			tokenHash: hashBotToken(token),
			allowedIps: [ '127.0.0.1' ],
			jobTypes: [ 'transcriber' ],
			apiUrl: 'https://tr.example.com',
			apiSecret: 'tr-key'
		}, internal);

		const verdict = await app.service('bot-verify').create({ tenantId, botToken: token, address: '127.0.0.1' }, internal);

		assert.strictEqual(verdict.allowed, true);
		assert.ok(verdict.allowed && verdict.verified);
		assert.strictEqual(verdict.allowed && verdict.verified && verdict.credentialId, Number(credential.id));
		assert.deepStrictEqual(verdict.allowed && verdict.verified && verdict.jobTypes, [ 'transcriber' ]);

		await app.service('tenantBotCredentials').remove(credential.id, internal);
	});
});
