import assert from 'assert';
import { app } from '../../src/app';

const internal = { provider: undefined, query: {} };
const HOUR = 3_600_000;
const idOf = (created: unknown) => Number((created as { id?: unknown })?.id ?? created);

describe('the meetings of a room that may still take place', () => {
	const stamp = `per-room-${Date.now()}`;
	const knex = () => app.get('postgresqlClient');
	const invites = app.get('invites');
	let tenantId: number;
	let owner: number;
	let roomA: number;
	let roomB: number;

	const asOwner = () => ({ ...internal, user: { id: owner, tenantId } });
	const create = async (roomId: number, over: Record<string, unknown> = {}) => idOf(await app.service('meetings').create({
		roomId,
		title: stamp,
		startsAt: Date.now() + HOUR,
		endsAt: Date.now() + (2 * HOUR),
		timezone: 'UTC',
		locale: 'en',
		...over
	} as never, asOwner() as never));
	const past = { startsAt: Date.now() - (3 * HOUR), endsAt: Date.now() - (2 * HOUR) };

	before(async () => {
		app.set('invites', { ...(invites ?? {}), maxMeetingsPerRoom: 2 });
		tenantId = idOf(await app.service('tenants').create({ name: stamp, description: 'meetings per room' }, internal));
		owner = idOf(await app.service('users').create({ email: `${stamp}@example.edu`, password: 'Pw-for-tests-1', tenantId }, internal));
		roomA = idOf(await app.service('rooms').create({ name: `${stamp}-a`, tenantId }, internal));
		roomB = idOf(await app.service('rooms').create({ name: `${stamp}-b`, tenantId }, internal));
	});

	afterEach(async () => {
		const ids = (await knex()('meetings').whereIn('roomId', [ roomA, roomB ])
			.select('id')).map((row: { id: unknown }) => Number(row.id));

		await knex()('meetingAttendees').whereIn('meetingId', ids)
			.delete();
		await knex()('meetings').whereIn('id', ids)
			.delete();
	});

	after(async () => {
		app.set('invites', invites);
		for (const id of [ roomA, roomB ]) if (id) await app.service('rooms').remove(id, internal);
		if (owner) await app.service('users').remove(owner, internal);
		if (tenantId) await app.service('tenants').remove(tenantId, internal);
	});

	it('refuses a meeting beyond the limit of the room', async () => {
		await create(roomA);
		await create(roomA);

		await assert.rejects(create(roomA), { code: 400 });
		assert.ok(await create(roomB), 'another room has its own limit');
	});

	it('does not count past single meetings, so a room keeps its history', async () => {
		await create(roomA, past);
		await create(roomA, past);
		await create(roomA, past);
		await create(roomA);
		await create(roomA);

		assert.ok(await create(roomA, past), 'a past single meeting fits even into a full room');
		await assert.rejects(create(roomA), { code: 400 });
	});

	it('counts a recurring meeting however long ago it started', async () => {
		await create(roomA, { startsAt: Date.UTC(2001, 0, 1, 9), endsAt: Date.UTC(2001, 0, 1, 10), rrule: 'FREQ=DAILY;INTERVAL=1;COUNT=5' });
		await create(roomA);

		await assert.rejects(create(roomA), { code: 400 });
	});

	it('refuses a patch that makes a past meeting recurring in a full room', async () => {
		await create(roomA);
		await create(roomA);
		const old = await create(roomA, past);

		await assert.rejects(app.service('meetings').patch(old, { rrule: 'FREQ=DAILY;INTERVAL=1;COUNT=5' } as never, asOwner() as never), { code: 400 });
	});

	it('refuses moving a meeting into a full room', async () => {
		await create(roomA);
		await create(roomA);
		const elsewhere = await create(roomB);

		await assert.rejects(app.service('meetings').patch(elsewhere, { roomId: roomA } as never, asOwner() as never), { code: 400 });
	});

	it('holds the limit for creates that arrive together', async () => {
		const results = await Promise.allSettled(Array.from({ length: 6 }, () => create(roomA)));
		const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

		assert.strictEqual(results.length - refused.length, 2);
		assert.ok(refused.every((r) => (r.reason as { code?: number })?.code === 400), String(refused[0]?.reason));
	}).timeout(20000);

	it('holds the limit for meetings moved into a room together', async () => {
		await create(roomA);
		const elsewhere = [];

		// Past ones, so they do not count in room B; the move makes them upcoming in room A.
		for (let i = 0; i < 4; i++) elsewhere.push(await create(roomB, past));

		const upcoming = { roomId: roomA, startsAt: Date.now() + HOUR, endsAt: Date.now() + (2 * HOUR) };
		const results = await Promise.allSettled(elsewhere.map((id) => app.service('meetings').patch(id, upcoming as never, asOwner() as never)));
		const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

		assert.strictEqual(results.length - refused.length, 1);
		assert.ok(refused.every((r) => (r.reason as { code?: number })?.code === 400), String(refused[0]?.reason));
	}).timeout(20000);

	it('lets a meeting that already counts be changed in a full room', async () => {
		const first = await create(roomA);

		await create(roomA);

		await app.service('meetings').patch(first, { title: `${stamp}-renamed`, roomId: roomA } as never, asOwner() as never);
	});
});
