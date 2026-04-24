import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('meetingOccurrenceRsvps', (table) => {
		table.bigIncrements('id').primary();
		table.bigint('meetingAttendeeId')
			.unsigned()
			.references('id')
			.inTable('meetingAttendees')
			.onDelete('CASCADE');
		// Epoch ms of the original occurrence start — equivalent to iCal RECURRENCE-ID
		table.bigint('recurrenceId');
		table.string('partstat').defaultTo('NEEDS-ACTION');
		table.bigint('replyDtstamp').nullable();
		table.integer('replySequence').nullable();
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.unique([ 'meetingAttendeeId', 'recurrenceId' ], { useConstraint: true });
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('meetingOccurrenceRsvps');
}
