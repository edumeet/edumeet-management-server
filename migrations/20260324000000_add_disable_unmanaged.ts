import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('defaults', (table) => {
		table.boolean('disableUnmanaged').defaultTo(false);
		table.boolean('disableUnmanagedLock').defaultTo(false);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('defaults', (table) => {
		table.dropColumn('disableUnmanaged');
		table.dropColumn('disableUnmanagedLock');
	});
}
