import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('tenantInviteConfigs', (table) => {
		table.bigIncrements('id').primary();
		table.bigint('tenantId').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
		table.boolean('enabled').defaultTo(true);
		table.string('organizerAddress');
		table.string('organizerName');
		table.string('smtpHost');
		table.integer('smtpPort');
		table.boolean('smtpSecure');
		table.string('smtpUser');
		table.text('smtpPass');
		table.string('imapHost').nullable();
		table.integer('imapPort').nullable();
		table.boolean('imapSecure').nullable();
		table.string('imapUser').nullable();
		table.text('imapPass').nullable();
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.unique([ 'tenantId' ], { useConstraint: true });
	});

	await knex.schema.createTable('meetings', (table) => {
		table.bigIncrements('id').primary();
		table.bigint('roomId').unsigned().references('id').inTable('rooms').onDelete('CASCADE');
		table.bigint('tenantId').unsigned().references('id').inTable('tenants').onDelete('CASCADE');
		table.bigint('organizerId').unsigned().references('id').inTable('users');
		table.string('title');
		table.text('description');
		table.bigint('startsAt');
		table.bigint('endsAt');
		table.string('timezone');
		table.string('locale').defaultTo('en');
		table.string('uid');
		table.integer('sequence').defaultTo(0);
		table.string('status').defaultTo('CONFIRMED');
		table.string('rrule').nullable();
		table.bigint('recurrenceEnd').nullable();
		table.integer('recurrenceCount').nullable();
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.unique([ 'uid' ], { useConstraint: true });
	});

	await knex.schema.createTable('meetingAttendees', (table) => {
		table.bigIncrements('id').primary();
		table.bigint('meetingId').unsigned().references('id').inTable('meetings').onDelete('CASCADE');
		table.bigint('userId').unsigned().references('id').inTable('users').nullable();
		table.string('email');
		table.string('name').nullable();
		table.string('partstat').defaultTo('NEEDS-ACTION');
		table.string('rsvpToken');
		table.integer('lastNotifiedSequence').defaultTo(-1);
		table.bigint('createdAt');
		table.bigint('updatedAt');
		table.unique([ 'meetingId', 'email' ], { useConstraint: true });
		table.unique([ 'rsvpToken' ], { useConstraint: true });
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('meetingAttendees');
	await knex.schema.dropTableIfExists('meetings');
	await knex.schema.dropTableIfExists('tenantInviteConfigs');
}
