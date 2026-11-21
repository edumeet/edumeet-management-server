import assert from 'assert';
import { createContext, type Params } from '@feathersjs/feathers';
import { app } from '../../../src/app';

const internal = { provider: undefined, query: {} };

// The room server looks a meeting up by room and token; the answer says whether the meeting is
// open now. Postgres returns the times as bigint strings, MySQL as numbers.
describe('meeting token window from the database', () => {
	const stamp = `tokenwindow-${Date.now()}`;
	let room: number;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svc = (path: string) => app.service(path as any) as any;
	const lookup = async (meetingToken?: string) => {
		const query = meetingToken ? { roomId: room, meetingToken, $limit: 1 } : { roomId: room, $limit: 10 };
		const result = await svc('meetings').find({ provider: undefined, query });

		return (Array.isArray(result) ? result : result.data) as Array<{ meetingToken: string, tokenWindow?: { state: string, startsAt: number } }>;
	};

	before(async () => {
		const tenant = Number((await svc('tenants').create({ name: stamp, description: 'A' }, internal)).id);
		const owner = Number((await svc('users').create({ email: `${stamp}@example.edu`, password: 'Pw-for-tests-1', tenantId: tenant }, internal)).id);

		room = Number((await svc('rooms').create({ name: `${stamp}-room`, tenantId: tenant }, internal)).id);

		const now = Date.now();
		const meeting = (token: string, startsAt: number) => app.get('postgresqlClient')('meetings').insert({
			roomId: room,
			tenantId: tenant,
			organizerId: owner,
			title: stamp,
			startsAt,
			endsAt: startsAt + 3_600_000,
			timezone: 'UTC',
			locale: 'en',
			uid: `${stamp}-${token}`,
			meetingToken: `${stamp}-${token}`,
			sequence: 0,
			status: 'CONFIRMED',
			createdAt: now,
			updatedAt: now
		});

		await meeting('later', now + (3 * 3_600_000));
		await meeting('now', now - (30 * 60_000));
		await meeting('ran', now - (3 * 3_600_000));
	});

	it('says early for a meeting more than an hour ahead, with its start', async () => {
		const [ found ] = await lookup(`${stamp}-later`);

		assert.strictEqual(found.tokenWindow?.state, 'early');
		assert.strictEqual(typeof found.tokenWindow?.startsAt, 'number');
	});

	it('says open for a meeting that is running', async () => {
		const [ found ] = await lookup(`${stamp}-now`);

		assert.strictEqual(found.tokenWindow?.state, 'open');
	});

	it('leaves the window out of a list without a token', async () => {
		const rows = await lookup();

		assert.strictEqual(rows.length, 3);
		assert.ok(rows.every((r) => r.tokenWindow === undefined));
	});

	describe('activity reported by the room server', () => {
		const report = (data: object, params: Params = internal as Params) => svc('meeting-activity').create(data, params);
		const lastActiveAt = async (token: string) =>
			(await app.get('postgresqlClient')('meetings').where({ meetingToken: `${stamp}-${token}` })
				.first('lastActiveAt'))?.lastActiveAt;

		it('keeps a meeting whose room is still in use open after its hour', async () => {
			assert.strictEqual((await lookup(`${stamp}-ran`))[0].tokenWindow?.state, 'over');

			assert.deepStrictEqual(await report({ roomId: room, meetingToken: `${stamp}-ran` }), { updated: 1 });

			assert.ok(Math.abs(Number(await lastActiveAt('ran')) - Date.now()) < 60_000);
			assert.strictEqual((await lookup(`${stamp}-ran`))[0].tokenWindow?.state, 'open');
		});

		// What the transport sends is context.dispatch, so the test asks for the context.
		it('gives the room server the window over the API, but not the time of the activity', async () => {
			const asServer = {
				provider: 'rest',
				authenticated: true,
				user: { id: 902, roles: [ 'edumeet-server' ] },
				query: { roomId: room, meetingToken: `${stamp}-ran`, $limit: 1 }
			} as unknown as Params;
			const context = await svc('meetings').find(asServer, createContext(svc('meetings'), 'find'));
			const sent = context.dispatch;
			const [ found ] = (Array.isArray(sent) ? sent : sent.data) as Array<{ tokenWindow?: { state: string }, lastActiveAt?: unknown }>;

			assert.notStrictEqual(context.result, sent);

			assert.strictEqual(found.tokenWindow?.state, 'open');
			assert.strictEqual(found.lastActiveAt, undefined);
		});

		it('touches nothing for another room or an unknown token', async () => {
			assert.deepStrictEqual(await report({ roomId: room + 1000000, meetingToken: `${stamp}-later` }), { updated: 0 });
			assert.deepStrictEqual(await report({ roomId: String(room), meetingToken: `${stamp}-nope` }), { updated: 0 });
			assert.strictEqual(await lastActiveAt('later'), null);
		});

		it('refuses a report without a room or a token', async () => {
			await assert.rejects(report({ meetingToken: `${stamp}-later` }), /roomId required/);
			await assert.rejects(report({ roomId: 'x', meetingToken: `${stamp}-later` }), /roomId required/);
			await assert.rejects(report({ roomId: room }), /meetingToken required/);
			await assert.rejects(report({ roomId: room, meetingToken: '' }), /meetingToken required/);
		});

		it('takes a report from the room server role over the API', async () => {
			const asServer = { provider: 'rest', authenticated: true, user: { id: 902, roles: [ 'edumeet-server' ] }, query: {} } as unknown as Params;

			assert.deepStrictEqual(await report({ roomId: room, meetingToken: `${stamp}-now` }, asServer), { updated: 1 });
		});

		it('not from a tenant admin, a plain user or nobody', async () => {
			for (const user of [ { id: 903, tenantAdmin: true, roles: [] }, { id: 904, roles: [] } ])
				await assert.rejects(report({ roomId: room, meetingToken: `${stamp}-later` }, { provider: 'rest', authenticated: true, user, query: {} } as unknown as Params));

			await assert.rejects(report({ roomId: room, meetingToken: `${stamp}-later` }, { provider: 'rest', query: {} } as unknown as Params));
			assert.strictEqual(await lastActiveAt('later'), null);
		});
	});
});
