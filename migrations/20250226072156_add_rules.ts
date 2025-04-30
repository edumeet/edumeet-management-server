import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('rules', (table) => {
		table.increments('id');
		table.string('name');
		table.bigint('tenantId').references('id').inTable('tenants').onDelete('CASCADE');
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