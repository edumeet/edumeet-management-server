import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		if (knex.client.config.client === 'pg') {
			table.specificType('allowedMediaNodeRegions', 'VARCHAR(32) ARRAY');
		} else if (knex.client.config.client === 'mysql' || knex.client.config.client === 'mysql2') {
			table.json('allowedMediaNodeRegions');
		} else {
			throw new Error(`Unsupported database client: ${knex.client.config.client}`);
		}
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		table.dropColumn('allowedMediaNodeRegions');
	});
}
