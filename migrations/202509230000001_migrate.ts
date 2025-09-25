import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('defaults', (table) => {
		// table.bigint('tenantId').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
		table.unique('tenantId', { useConstraint: true });
	});
}
export async function down(knex: Knex): Promise<void> {

}