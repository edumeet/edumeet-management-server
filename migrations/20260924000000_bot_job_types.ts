import { Knex } from 'knex';

// A provider row offers a set of job types rather than one: a bot the provider
// starts for a session records, streams and transcribes as the jobs come and go.
export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantBotCredentials', (table) => {
		// A JSON list of recorder | transcriber | streamer, null for a row that is only a bot key.
		table.text('jobTypes').nullable();
	});

	const rows = await knex('tenantBotCredentials').whereNotNull('jobType')
		.select('id', 'jobType') as { id: number; jobType: string }[];

	for (const row of rows) {
		await knex('tenantBotCredentials').where({ id: row.id })
			.update({ jobTypes: JSON.stringify([ row.jobType ]) });
	}

	await knex.schema.alterTable('tenantBotCredentials', (table) => {
		table.dropColumn('jobType');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantBotCredentials', (table) => {
		table.string('jobType').nullable();
	});

	const rows = await knex('tenantBotCredentials').whereNotNull('jobTypes')
		.select('id', 'jobTypes') as { id: number; jobTypes: string }[];

	for (const row of rows) {
		let first: string | undefined;

		try {
			first = (JSON.parse(row.jobTypes) as string[])[0];
		} catch {
			first = undefined;
		}

		if (first) await knex('tenantBotCredentials').where({ id: row.id }).update({ jobType: first });
	}

	await knex.schema.alterTable('tenantBotCredentials', (table) => {
		table.dropColumn('jobTypes');
	});
}
