import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('defaults', (table) => {
		table.boolean('endToEndEncryption').defaultTo(false);
		table.boolean('endToEndEncryptionLock').defaultTo(false);
	});
	await knex.schema.alterTable('rooms', (table) => {
		// Nullable on purpose: an unset per-room value falls back to tenant default / server config.
		table.boolean('endToEndEncryption');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('rooms', (table) => {
		table.dropColumn('endToEndEncryption');
	});
	await knex.schema.alterTable('defaults', (table) => {
		table.dropColumn('endToEndEncryption');
		table.dropColumn('endToEndEncryptionLock');
	});
}
