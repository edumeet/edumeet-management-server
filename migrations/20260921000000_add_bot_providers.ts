import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantBotCredentials', (table) => {
		// recorder | transcriber | streamer, null for a row that is only a bot key.
		table.string('jobType').nullable();
		// https:// base url of the provider proxy that runs this kind of job.
		table.string('apiUrl', 512).nullable();
		// The provider's own api key, encrypted with bots.encryptionKey.
		table.text('apiSecret').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantBotCredentials', (table) => {
		table.dropColumn('jobType');
		table.dropColumn('apiUrl');
		table.dropColumn('apiSecret');
	});
}
