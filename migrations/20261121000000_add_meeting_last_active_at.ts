import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('meetings', (table) => {
		// Written by the room server while the meeting's room is in use and when it empties.
		table.bigInteger('lastActiveAt').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('meetings', (table) => {
		table.dropColumn('lastActiveAt');
	});
}
