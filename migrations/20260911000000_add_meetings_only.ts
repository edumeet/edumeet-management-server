import { Knex } from 'knex';
import { randomBytes } from 'crypto';

// Migrations never import from src, so the generator is repeated here; keep it in step with
// src/services/meetings/meetingToken.ts.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 12;

const generateMeetingToken = (): string => {
	const bytes = randomBytes(LENGTH);
	let token = '';

	for (let i = 0; i < LENGTH; i++) token += ALPHABET[bytes[i] % ALPHABET.length];

	return token;
};

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('rooms', (table) => {
		table.boolean('meetingsOnly').notNullable().defaultTo(false);
	});

	await knex.schema.alterTable('meetings', (table) => {
		table.string('meetingToken', 32);
	});

	const rows: Array<{ id: number | string }> = await knex('meetings').select('id');

	for (const row of rows) {
		await knex('meetings')
			.where({ id: row.id })
			.update({ meetingToken: generateMeetingToken() });
	}

	await knex.schema.alterTable('meetings', (table) => {
		table.string('meetingToken', 32).notNullable().alter();
		table.unique([ 'meetingToken' ], { useConstraint: true });
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('meetings', (table) => {
		table.dropUnique([ 'meetingToken' ]);
		table.dropColumn('meetingToken');
	});

	await knex.schema.alterTable('rooms', (table) => {
		table.dropColumn('meetingsOnly');
	});
}
