import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantOAuths', (table) => {
		// Treat the provider's e-mail as verified even without email_verified: true. For
		// providers that never verify but take the address from a managed directory, such
		// as Feide, which always sends email_verified: false.
		table.boolean('trust_email').notNullable().defaultTo(false);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenantOAuths', (table) => {
		table.dropColumn('trust_email');
	});
}
