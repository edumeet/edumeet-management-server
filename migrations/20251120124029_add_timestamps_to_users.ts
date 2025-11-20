import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.bigint('createdAt');
    table.bigint('updatedAt');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('createdAt');
    table.dropColumn('updatedAt');
  });
}