import assert from 'assert';
import type { Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';
import { MAX_IDS } from '../../../src/hooks/isRoomOwnerOrAdminForMeeting';

const internal = { provider: undefined, query: {} };

// The room check of the meeting services reads the parents of the ids a request names. What
// it costs must not grow with the length of the list, and not with repeats of one id.
describe('meeting services with long id lists', () => {
	const stamp = `idlists-${Date.now()}`;
	let tenant: number;
	let owner: number;
	let stranger: number;
	let room: number;
	let otherRoom: number;
	let meeting: number;
	let attendees: number[] = [];
	let queries = 0;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svc = (path: string) => app.service(path as any) as any;
	const as = (id: number, query: Record<string, unknown>): Params => ({
		provider: 'rest',
		authenticated: true,
		user: { id, tenantId: tenant, tenantAdmin: false, tenantOwner: false, roles: [] as string[] },
		query,
	}) as unknown as Params;
	const count = () => { queries++; };
	const counted = async (call: () => Promise<unknown>): Promise<number> => {
		queries = 0;
		await call();

		return queries;
	};

	before(async () => {
		const user = async (name: string) =>
			Number((await svc('users').create({ email: `${stamp}-${name}@example.edu`, password: 'Pw-for-tests-1', tenantId: tenant }, internal)).id);

		tenant = Number((await svc('tenants').create({ name: stamp, description: 'A' }, internal)).id);
		owner = await user('owner');
		stranger = await user('stranger');
		room = Number((await svc('rooms').create({ name: `${stamp}-room`, tenantId: tenant }, internal)).id);
		otherRoom = Number((await svc('rooms').create({ name: `${stamp}-other`, tenantId: tenant }, internal)).id);
		await svc('roomOwners').create({ roomId: room, userId: owner }, internal);

		const now = Date.now();
		const knex = app.get('postgresqlClient');
		const id = (rows: Array<number | { id: number }>) => Number(typeof rows[0] === 'object' ? rows[0].id : rows[0]);

		meeting = id(await knex('meetings').insert({
			roomId: room,
			tenantId: tenant,
			organizerId: owner,
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

		for (const name of [ 'x', 'y' ]) {
			attendees.push(id(await knex('meetingAttendees').insert({
				meetingId: meeting,
				email: `${stamp}-${name}@example.org`,
				partstat: 'NEEDS-ACTION',
				rsvpToken: `${stamp}-${name}`,
				lastNotifiedSequence: 0,
				createdAt: now,
				updatedAt: now
			}, [ 'id' ])));
		}

		knex.on('query', count);
	});

	after(async () => {
		const knex = app.get('postgresqlClient');

		knex.removeListener('query', count);
		if (attendees.length) await knex('meetingAttendees').whereIn('id', attendees)
			.del();
		attendees = [];
		if (meeting) await knex('meetings').where({ id: meeting })
			.del();
		await knex('roomOwners').where({ roomId: room })
			.del();
		for (const id of [ room, otherRoom ]) if (id) await svc('rooms').remove(id, internal);
		for (const id of [ owner, stranger ]) if (id) await svc('users').remove(id, internal);
		if (tenant) await svc('tenants').remove(tenant, internal);
	});

	it('answers a list of all attendees', async () => {
		const found = await svc('meetingOccurrenceRsvps').find(as(owner, { meetingAttendeeId: { $in: attendees } }));

		assert.strictEqual(found.total, 0);
	});

	it('costs the same for one id as for the same id a thousand times', async () => {
		const once = await counted(() => svc('meetingOccurrenceRsvps').find(as(owner, { meetingAttendeeId: { $in: [ attendees[0] ] } })));
		const often = await counted(() => svc('meetingOccurrenceRsvps').find(as(owner, { meetingAttendeeId: { $in: Array(MAX_IDS).fill(attendees[0]) } })));

		assert.ok(once > 0);
		assert.strictEqual(often, once);

		const meetingOnce = await counted(() => svc('meetingAttendees').find(as(owner, { meetingId: { $in: [ meeting ] } })));
		const meetingOften = await counted(() => svc('meetingAttendees').find(as(owner, { meetingId: { $in: Array(MAX_IDS).fill(meeting) } })));

		assert.strictEqual(meetingOften, meetingOnce);
	});

	it('refuses a longer list without a query', async () => {
		const tooMany = Array(MAX_IDS + 1).fill(attendees[0]);

		assert.strictEqual(await counted(() => assert.rejects(
			svc('meetingOccurrenceRsvps').find(as(owner, { meetingAttendeeId: { $in: tooMany } })),
			{ name: 'BadRequest' }
		)), 0);
		assert.strictEqual(await counted(() => assert.rejects(
			svc('meetingAttendees').find(as(owner, { meetingId: { $in: Array(MAX_IDS + 1).fill(meeting) } })),
			{ name: 'BadRequest' }
		)), 0);
	});

	it('costs a tenant admin the same for one room as for many', async () => {
		const admin = (query: Record<string, unknown>) => {
			const params = as(owner, query);

			(params.user as Record<string, unknown>).tenantAdmin = true;

			return params;
		};
		const one = await counted(() => svc('meetings').find(admin({ roomId: { $in: [ room ] } })));
		const many = await counted(() => svc('meetings').find(admin({ roomId: { $in: [ room, otherRoom ] } })));

		assert.strictEqual(many, one);
	});

	it('does not find a meeting once the caller is of another tenant', async () => {
		const params = as(owner, { meetingId: meeting });

		(params.user as Record<string, unknown>).tenantId = tenant + 1000;
		await assert.rejects(svc('meetingAttendees').find(params), { name: 'NotFound' });
	});

	it('still refuses someone who does not own the room, in a few queries', async () => {
		const cost = await counted(() => assert.rejects(
			svc('meetingOccurrenceRsvps').find(as(stranger, { meetingAttendeeId: { $in: Array(MAX_IDS).fill(attendees[0]) } })),
			/not an owner/
		));

		assert.ok(cost <= 5, `${cost} queries`);
	});
});
