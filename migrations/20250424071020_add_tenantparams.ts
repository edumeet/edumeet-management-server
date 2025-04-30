import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantOAuths', (table) => {
		table.string('end_session_endpoint');
		table.string('name_parameter');
		
	});
}

export async function down(knex: Knex): Promise<void> {

}