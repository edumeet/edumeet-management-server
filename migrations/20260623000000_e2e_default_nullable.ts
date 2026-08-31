import { Knex } from 'knex';

// Follow-up to 20260622000000_add_e2e_encryption: that migration gave defaults.endToEndEncryption a
// non-null default of `false`, which shadows the room-server config for every managed tenant
// (resolution is room ?? tenant ?? serverConfig ?? false — a non-null tenant `false` stops the chain).
// Drop the default so an unset tenant default is NULL and falls through to the config.
// The column is already nullable (boolean without notNullable); only the DEFAULT needs to go.
// Done through the schema builder rather than raw SQL: raw is passed through verbatim, so a
// Postgres-quoted identifier is a string literal on MySQL and the statement fails there.
export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('defaults', (table) => {
		table.boolean('endToEndEncryption').alter();
	});

	// The original migration backfilled every existing row to `false`. Those were never an explicit
	// choice (the feature was brand new), so reset them to NULL to restore the config fallback.
	await knex('defaults')
		.where({ endToEndEncryption: false })
		.update({ endToEndEncryption: null });
}

export async function down(knex: Knex): Promise<void> {
	await knex('defaults')
		.whereNull('endToEndEncryption')
		.update({ endToEndEncryption: false });

	await knex.schema.alterTable('defaults', (table) => {
		table.boolean('endToEndEncryption').defaultTo(false).alter();
	});
}
