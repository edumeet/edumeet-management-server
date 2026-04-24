import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('meetingAttendees', (table) => {
		table.bigint('replyDtstamp').nullable();
		table.integer('replySequence').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('meetingAttendees', (table) => {
		table.dropColumn('replyDtstamp');
		table.dropColumn('replySequence');
	});
}
