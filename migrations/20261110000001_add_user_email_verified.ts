import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('users', (table) => {
		// Whether the identity provider vouched for the stored address when it was last set.
		// false: an unverified claim, which must not decide access, grants or linking.
		// null: an account from before this column, treated as before.
		table.boolean('emailVerified').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('users', (table) => {
		table.dropColumn('emailVerified');
	});
}
