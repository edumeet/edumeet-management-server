import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('rules', (table) => {
		table.bigIncrements('id');
		table.string('name');
		table.bigint('tenantId').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
		table.string('parameter');
		table.string('method');
		table.boolean('negate');
		table.string('value');
		table.string('action');
		table.string('type');
		table.string('accessId');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable('rules');
}