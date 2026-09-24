import assert from 'assert';
import { app } from '../../src/app';
import { down, up } from '../../migrations/20260924000000_bot_job_types';

const internal = { provider: undefined, query: {} };

// Run against the suite's own database, so it proves the conversion on whichever
// dialect the suite runs on. The schema is left at the latest migration again.
describe('the migration to several job types per provider', () => {
	let tenantId: number;

	before(async () => {
		tenantId = Number((await app.service('tenants').create({ name: `job-types-${Date.now()}`, description: 'migration' }, internal)).id);
	});

	after(async () => {
		await app.service('tenants').remove(tenantId, internal);
	});

	it('carries a single job type into the list and back, and leaves a plain key a plain key', async () => {
		const knex = app.get('postgresqlClient');
		const row = (label: string, hash: string, jobType: string | null) => ({
			tenantId,
			label,
			tokenHash: hash.repeat(64),
			allowedIps: '["127.0.0.1"]',
			enabled: true,
			createdAt: 0,
			jobType,
			apiUrl: jobType ? 'https://x.example' : null,
			apiSecret: jobType ? 's' : null
		});
		const read = async (column: string) => Object.fromEntries((await knex('tenantBotCredentials').where({ tenantId })
			.select('label', column)).map((r: Record<string, unknown>) => [ r.label, r[column] ]));

		await down(knex);

		try {
			await knex('tenantBotCredentials').insert([ row('mig-rec', 'c', 'transcriber'), row('mig-plain', 'd', null) ]);
			await up(knex);

			assert.deepStrictEqual(await read('jobTypes'), { 'mig-rec': '["transcriber"]', 'mig-plain': null });

			await down(knex);
			assert.deepStrictEqual(await read('jobType'), { 'mig-rec': 'transcriber', 'mig-plain': null });
		} finally {
			if (!(await knex.schema.hasColumn('tenantBotCredentials', 'jobTypes'))) await up(knex);
			await knex('tenantBotCredentials').where({ tenantId })
				.delete();
		}

		assert.strictEqual(await knex.schema.hasColumn('tenantBotCredentials', 'jobType'), false);
	});
});
