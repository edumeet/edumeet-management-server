import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		// Empty means the room-server's own value, which also caps this one.
		table.integer('maxBotJobsPerRoom').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		table.dropColumn('maxBotJobsPerRoom');
	});
}
