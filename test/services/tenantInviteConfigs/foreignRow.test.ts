import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// A patch is checked against the stored row before it is written. That row has to be the
// caller's own: what the check answers must say nothing about another tenant's settings.
describe('invitation settings of another tenant', () => {
	const tenants: number[] = [];
	const configs: Record<string, number> = {};
	let hadKey: unknown;

	const admin = (tenantId: number): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id: 9001, tenantId, tenantAdmin: true, tenantOwner: false, roles: [] as string[] },
		query: {}
	}) as unknown as Params;
	const complete = (tenantId: number, over: Record<string, unknown> = {}) => ({
		tenantId,
		enabled: true,
		organizerAddress: 'invitation@example.com',
		smtpHost: 'smtp.example.com',
		smtpPort: 465,
		smtpSecure: true,
		smtpUser: 'invitation@example.com',
		smtpPass: 'secret',
		imapHost: 'imap.example.com',
		imapUser: 'invitation@example.com',
		imapPass: 'secret',
		...over
	});
	const answer = async (id: number, body: Record<string, unknown>, as: number): Promise<string> => {
		try {
			await app.service('tenantInviteConfigs').patch(id, body as never, admin(as));

			return 'patched';
		} catch (error) {
			return `${(error as { name: string }).name}: ${(error as Error).message}`;
		}
	};

	before(async () => {
		hadKey = app.get('invites');
		app.set('invites', { ...(hadKey as object), encryptionKey: 'a'.repeat(64) } as never);

		for (const name of [ 'own', 'enabled', 'disabled', 'noImap' ]) {
			const tenantId = Number((await app.service('tenants').create({ name: `inv-${name}-${Date.now()}`, description: '' }, internal)).id);

			tenants.push(tenantId);
			const data = {
				own: complete(tenantId),
				enabled: complete(tenantId),
				disabled: complete(tenantId, { enabled: false, smtpPass: '', imapPass: '' }),
				noImap: complete(tenantId, { imapHost: '', imapUser: '', imapPass: '' })
			}[name];

			configs[name] = Number((await app.service('tenantInviteConfigs').create(data as never, internal)).id);
		}
	});

	after(async () => {
		for (const id of Object.values(configs)) await app.service('tenantInviteConfigs').remove(id, internal)
			.catch(() => undefined);
		for (const id of tenants) await app.service('tenants').remove(id, internal)
			.catch(() => undefined);
		app.set('invites', hadKey as never);
	});

	it('answers the same for every row of another tenant and for a row that does not exist', async () => {
		const bodies = [
			{},
			{ enabled: true },
			{ smtpHost: '' },
			{ enabled: true, smtpPass: '' },
			{ enabled: true, imapUser: '', imapPass: '' },
			{ enabled: true, organizerAddress: '', smtpHost: '', smtpUser: '' }
		];

		for (const body of bodies) {
			const answers = new Set<string>();

			for (const id of [ configs.enabled, configs.disabled, configs.noImap, 2 ** 40 ])
				answers.add((await answer(id, body, tenants[0])).replace(/'\d+'/, '\'id\''));

			assert.strictEqual(answers.size, 1, `${JSON.stringify(body)}: ${[ ...answers ].join(' | ')}`);
			assert.match([ ...answers ][0], /^NotFound/);
		}
	});

	it('changes nothing in the row of another tenant', async () => {
		await answer(configs.enabled, { smtpHost: 'elsewhere.example.com' }, tenants[0]);

		assert.strictEqual((await app.service('tenantInviteConfigs').get(configs.enabled, internal)).smtpHost, 'smtp.example.com');
	});

	it('still checks the caller\'s own row as a whole', async () => {
		assert.match(await answer(configs.own, { smtpHost: '' }, tenants[0]), /^BadRequest: Cannot enable invites: missing SMTP host/);
		assert.match(await answer(configs.own, { imapUser: '' }, tenants[0]), /missing IMAP user/);
		// the stored passwords count
		assert.strictEqual(await answer(configs.own, { organizerName: 'Invitations' }, tenants[0]), 'patched');
		assert.strictEqual(await answer(configs.own, { enabled: false, smtpHost: '' }, tenants[0]), 'patched');
	});

	it('lets a super admin patch the row of any tenant, checked as a whole', async () => {
		const superAdmin = { provider: 'rest', authenticated: true, user: { id: 1, tenantId: null, roles: [ 'super-admin' ] }, query: {} } as unknown as Params;

		await assert.rejects(app.service('tenantInviteConfigs').patch(configs.enabled, { smtpUser: '' } as never, superAdmin), /missing SMTP user/);
		await app.service('tenantInviteConfigs').patch(configs.enabled, { organizerName: 'Invitations' } as never, superAdmin);
	});
});
