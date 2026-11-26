import assert from 'assert';
import { app } from '../../src/app';
import { processReplyIcs } from '../../src/invites/replyPoller';
import { logger } from '../../src/logger';

const internal = { provider: undefined, query: {} };

// A reply is read from a mailbox, and a mailbox belongs to the tenants that configured it.
// Whoever can put a message into the mailbox of one tenant must not answer for the guests
// of another tenant's meeting. Against the database, not a stand-in.
describe('replies and the tenant of the meeting', () => {
	const stamp = `reply-tenant-${Date.now()}`;
	const guest = `${stamp}@example.org`;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svc = (path: string) => app.service(path as any) as any;
	const knex = () => app.get('postgresqlClient');
	let mailboxTenant: number;
	let meetingTenant: number;
	let meeting: number;
	let attendee: number;

	const reply = (partstat: string, recurrenceId?: string): string => [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'METHOD:REPLY',
		'BEGIN:VEVENT',
		`UID:${stamp}@example.edu`,
		'SEQUENCE:0',
		'DTSTAMP:20260910T090000Z',
		'DTSTART:20260910T100000Z',
		...(recurrenceId ? [ `RECURRENCE-ID:${recurrenceId}` ] : []),
		`ATTENDEE;PARTSTAT=${partstat}:mailto:${guest}`,
		'END:VEVENT',
		'END:VCALENDAR'
	].join('\r\n');
	const answer = async (): Promise<string> => (await knex()('meetingAttendees').where({ id: attendee })
		.first('partstat')).partstat;
	const occurrenceAnswers = async (): Promise<number> => (await knex()('meetingOccurrenceRsvps').where({ meetingAttendeeId: attendee })).length;

	before(async () => {
		logger.transports.forEach((t) => (t.silent = true));

		const id = (rows: Array<number | { id: number }>) => Number(typeof rows[0] === 'object' ? rows[0].id : rows[0]);
		const now = Date.now();

		mailboxTenant = Number((await svc('tenants').create({ name: `${stamp}-mailbox`, description: '' }, internal)).id);
		meetingTenant = Number((await svc('tenants').create({ name: `${stamp}-meeting`, description: '' }, internal)).id);

		const organizer = Number((await svc('users').create({ email: `${stamp}@example.edu`, password: 'Pw-for-tests-1', tenantId: meetingTenant }, internal)).id);
		const room = Number((await svc('rooms').create({ name: `${stamp}-room`, tenantId: meetingTenant }, internal)).id);

		meeting = id(await knex()('meetings').insert({
			roomId: room,
			tenantId: meetingTenant,
			organizerId: organizer,
			title: stamp,
			startsAt: now,
			endsAt: now + 1,
			timezone: 'UTC',
			locale: 'en',
			uid: `${stamp}@example.edu`,
			meetingToken: stamp,
			sequence: 0,
			status: 'CONFIRMED',
			createdAt: now,
			updatedAt: now
		}, [ 'id' ]));
		attendee = id(await knex()('meetingAttendees').insert({
			meetingId: meeting,
			email: guest,
			partstat: 'ACCEPTED',
			rsvpToken: stamp,
			lastNotifiedSequence: 0,
			createdAt: now,
			updatedAt: now
		}, [ 'id' ]));
	});

	after(async () => {
		logger.transports.forEach((t) => (t.silent = false));
		await knex()('meetingOccurrenceRsvps').where({ meetingAttendeeId: attendee })
			.del();
		await knex()('meetingAttendees').where({ meetingId: meeting })
			.del();
		await knex()('meetings').where({ id: meeting })
			.del();
		await knex()('rooms').where({ tenantId: meetingTenant })
			.del();
		await knex()('users').where({ tenantId: meetingTenant })
			.del();
		await knex()('tenants').whereIn('id', [ mailboxTenant, meetingTenant ])
			.del();
	});

	it('a reply in the mailbox of another tenant changes no answer and stays unclaimed', async () => {
		const series = await processReplyIcs(app, reply('DECLINED'), guest, [ mailboxTenant ]);
		const occurrence = await processReplyIcs(app, reply('DECLINED', '20260917T100000Z'), guest, [ mailboxTenant ]);

		assert.deepStrictEqual(series, { isReply: true, claimed: 0, updated: 0 });
		assert.deepStrictEqual(occurrence, { isReply: true, claimed: 0, updated: 0 });
		assert.strictEqual(await answer(), 'ACCEPTED');
		assert.strictEqual(await occurrenceAnswers(), 0);
	});

	it('a reply in a mailbox the meeting\'s tenant shares is applied', async () => {
		const occurrence = await processReplyIcs(app, reply('TENTATIVE', '20260917T100000Z'), guest, [ mailboxTenant, meetingTenant ]);
		const series = await processReplyIcs(app, reply('DECLINED'), guest, [ mailboxTenant, meetingTenant ]);

		assert.deepStrictEqual(occurrence, { isReply: true, claimed: 1, updated: 1 });
		assert.deepStrictEqual(series, { isReply: true, claimed: 1, updated: 1 });
		assert.strictEqual(await answer(), 'DECLINED');
		assert.strictEqual(await occurrenceAnswers(), 1);
	});
});
