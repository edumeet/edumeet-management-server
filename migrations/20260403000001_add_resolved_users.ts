import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('resolvedUsers', (table) => {
		table.bigIncrements('id').primary();
		table.bigInteger('userId').notNullable().references('id').inTable('users').onDelete('CASCADE');
		table.bigInteger('resolvedUserId').notNullable().references('id').inTable('users').onDelete('CASCADE');
		table.unique([ 'userId', 'resolvedUserId' ]);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('resolvedUsers');
}
