import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		// The language the tenant writes to its people in; a translation file code.
		table.string('locale', 8).nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		table.dropColumn('locale');
	});
}
