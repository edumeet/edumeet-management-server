import assert from 'assert';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

const internal = { provider: undefined, query: {} };
const knex = () => app.get('postgresqlClient');
const idOf = (created: unknown) => Number((created as { id?: unknown })?.id ?? created);

// The client creates a new meeting's guests all at once; the limit must hold for that too.
describe('the number of attendees of a meeting', () => {
	const stamp = Date.now();
	const invites = app.get('invites');
	let tenantId: number;
	let roomId: number;
	let meetingId: number;

	const count = async () => {
		const [ { total } ] = await knex()('meetingAttendees').where({ meetingId })
			.count({ total: '*' });

		return Number(total);
	};
	const create = (email: string) => app.service('meetingAttendees').create({ meetingId, email } as never, internal);

	before(async () => {
		tenantId = Number((await app.service('tenants').create({ name: `limit-${stamp}`, description: 'attendee limit test' }, internal)).id);
		roomId = idOf((await knex()('rooms').insert({ name: `limit-room-${stamp}`, tenantId })
			.returning('id'))[0]);
		app.set('invites', { ...invites, maxAttendeesPerMeeting: 3 });
	});

	beforeEach(async () => {
		meetingId = idOf((await knex()('meetings').insert({
			roomId,
			tenantId,
			title: 'limit',
			uid: `limit-${randomUUID()}`,
			meetingToken: randomUUID().replace(/-/g, ''),
			startsAt: Date.now() + 86400000,
			endsAt: Date.now() + 90000000,
			timezone: 'UTC'
		})
			.returning('id'))[0]);
	});

	after(async () => {
		app.set('invites', invites);
		await knex()('rooms').where({ id: roomId })
			.delete();
		await app.service('tenants').remove(tenantId, internal);
	});

	it('is limited when guests are added one after another', async () => {
		for (const i of [ 0, 1, 2 ]) await create(`one-${i}@example.org`);

		await assert.rejects(create('one-3@example.org'), /at most 3 attendees/);
		assert.strictEqual(await count(), 3);
	});

	// More than the database pool has connections, each checked against the caller's tenant: the
	// transaction must not wait for a second connection while it holds the meeting's lock.
	it('takes many users of the tenant at once without waiting for the connection pool', async () => {
		app.set('invites', { ...invites, maxAttendeesPerMeeting: 50 });

		try {
			const userIds: number[] = [];

			for (let i = 0; i < 13; i++) userIds.push(idOf((await knex()('users').insert({ email: `pool-${stamp}-${i}@example.org`, name: `U${i}`, tenantId })
				.returning('id'))[0]));

			const params = { provider: 'rest', authenticated: true, user: { id: userIds[0], tenantId, tenantAdmin: true, roles: [] } };
			const started = Date.now();
			const results = await Promise.allSettled(userIds.slice(1).map((userId, i) =>
				app.service('meetingAttendees').create({ meetingId, userId, email: `pool-${stamp}-${i + 1}@example.org` } as never, params as never)));

			assert.deepStrictEqual(results.map((r) => r.status), userIds.slice(1).map(() => 'fulfilled'));
			assert.ok(Date.now() - started < 10000, `took ${Date.now() - started} ms`);
		} finally {
			app.set('invites', { ...invites, maxAttendeesPerMeeting: 3 });
		}
	}).timeout(30000);

	it('is limited when guests are created all at once, as the client does for a new meeting', async () => {
		const results = await Promise.allSettled([ 0, 1, 2, 3, 4, 5 ].map((i) => create(`all-${i}@example.org`)));

		assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 3);
		assert.strictEqual(await count(), 3);
	});
});
