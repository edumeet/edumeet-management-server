import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('tenants', (table) => {
		// disabled | tokenOnly | all
		table.string('botPolicy').defaultTo('disabled');
	});

	await knex.schema.createTable('tenantBotCredentials', (table) => {
		table.bigIncrements('id').primary();
		table.bigint('tenantId').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
		table.string('label');
		// SHA-256 of the token, hex. The token itself is never stored.
		table.string('tokenHash', 64);
		// JSON array of IPv4/IPv6 addresses or CIDR ranges, as text on both dialects.
		table.text('allowedIps');
		table.boolean('enabled').defaultTo(true);
		table.bigint('createdAt');
		table.bigint('lastUsedAt').nullable();
		table.unique([ 'tenantId', 'tokenHash' ], { useConstraint: true });
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('tenantBotCredentials');
	await knex.schema.alterTable('tenants', (table) => {
		table.dropColumn('botPolicy');
	});
}
