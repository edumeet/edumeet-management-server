import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

	
	await knex.schema.alterTable('rooms', (table) => {
		table.boolean('reactionsEnabled');
	});
	await knex.schema.alterTable('defaults', (table) => {
		table.boolean('reactionsEnabledLock');
		table.boolean('reactionsEnabledUnmanaged');
	});
		
}
export async function down(knex: Knex): Promise<void> {

}