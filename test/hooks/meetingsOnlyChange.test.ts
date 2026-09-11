import assert from 'assert';

import { rememberMeetingsOnly, resendInvitesOnMeetingsOnlyChange } from '../../src/hooks/meetingsOnlyChange';
import { DISPATCH_DEBOUNCE_MS } from '../../src/invites/dispatcher';
import type { HookContext } from '../../src/declarations';
import { logger } from '../../src/logger';

const DEBOUNCE_WAIT_MS = DISPATCH_DEBOUNCE_MS + 300;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface MeetingRow {
	id: number;
	notified: boolean;
	ended?: boolean;
}

interface Harness {
	// eslint-disable-next-line no-unused-vars
	context: (over: Partial<HookContext>) => HookContext;
	roomReads: number;
	meetingLookups: number;
	increments: number[];
}

const harness = (stored: boolean | number, meetings: MeetingRow[]): Harness => {
	const state = { roomReads: 0, meetingLookups: 0, increments: [] as number[] };

	const knex = (table: string) => {
		if (table === 'rooms') {
			return {
				where: () => ({
					first: async () => {
						state.roomReads++;

						return { meetingsOnly: stored };
					}
				})
			};
		}
		if (table === 'meetings') {
			return {
				where: (arg: { id?: number, roomId?: number }) => ({
					select: async () => {
						state.meetingLookups++;

						return meetings.map((m) => ({
							id: m.id,
							startsAt: m.ended ? Date.now() - 7_200_000 : Date.now() + 3_600_000,
							endsAt: m.ended ? Date.now() - 3_600_000 : Date.now() + 7_200_000,
							rrule: null,
							timezone: 'UTC'
						}));
					},
					increment: async () => {
						state.increments.push(arg.id as number);
					}
				})
			};
		}
		throw new Error(`unexpected table ${table}`);
	};

	const app = {
		get: (k: string) => (k === 'postgresqlClient' ? knex : undefined),
		service: (name: string) => {
			if (name === 'meetingAttendees') {
				return {
					find: async (params: { query: { meetingId: number } }) => {
						const m = meetings.find((x) => x.id === params.query.meetingId);

						return [ { id: 1, lastNotifiedSequence: m?.notified ? 0 : -1 } ];
					}
				};
			}
			if (name === 'meetings') return { get: async (id: number) => ({ id, tenantId: 1, roomId: 7, sequence: 0 }) };
			if (name === 'tenantInviteConfigs') return { find: async () => [] };
			throw new Error(`unexpected service ${name}`);
		}
	};

	return {
		context: (over) => ({ app, id: 7, params: {}, data: {}, ...over } as unknown as HookContext),
		get roomReads() { return state.roomReads; },
		get meetingLookups() { return state.meetingLookups; },
		get increments() { return state.increments; }
	};
};

describe('meetingsOnly change on a room re-sends its invites', () => {
	before(() => logger.transports.forEach((t) => (t.silent = true)));
	after(() => logger.transports.forEach((t) => (t.silent = false)));

	it('ignores a patch that does not touch the flag', async () => {
		const h = harness(false, [ { id: 1, notified: true } ]);
		const ctx = h.context({ data: { locked: true } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: false } } as HookContext);

		assert.strictEqual(h.roomReads, 0);
		assert.strictEqual(h.meetingLookups, 0);
	});

	it('ignores a multi patch, which has no id', async () => {
		const h = harness(false, [ { id: 1, notified: true } ]);
		const ctx = h.context({ id: undefined, data: { meetingsOnly: true } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: [] } as unknown as HookContext);

		assert.strictEqual(h.roomReads, 0);
		assert.strictEqual(h.meetingLookups, 0);
	});

	it('does nothing when the flag is written with the value it already had', async () => {
		const h = harness(true, [ { id: 1, notified: true } ]);
		const ctx = h.context({ data: { meetingsOnly: true } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: true } } as HookContext);

		assert.strictEqual(h.roomReads, 1);
		assert.strictEqual(h.meetingLookups, 0);
	});

	it('bumps every notified meeting of the room once when the flag flips on', async () => {
		const h = harness(false, [ { id: 1, notified: true }, { id: 2, notified: true }, { id: 3, notified: false } ]);
		const ctx = h.context({ data: { meetingsOnly: true } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: true } } as HookContext);
		await wait(DEBOUNCE_WAIT_MS);

		assert.deepStrictEqual([ ...h.increments ].sort(), [ 1, 2 ], 'a meeting nobody was told about yet goes out at SEQUENCE:0 with the new link');
	}).timeout(10000);

	it('leaves meetings that are already over alone, so a flip does not mail the whole history', async () => {
		const h = harness(false, [ { id: 1, notified: true, ended: true }, { id: 2, notified: true } ]);
		const ctx = h.context({ data: { meetingsOnly: true } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: true } } as HookContext);
		await wait(DEBOUNCE_WAIT_MS);

		assert.deepStrictEqual(h.increments, [ 2 ]);
	}).timeout(10000);

	it('re-sends when the flag flips off as well, so attendees get the bare link', async () => {
		const h = harness(true, [ { id: 4, notified: true } ]);
		const ctx = h.context({ data: { meetingsOnly: false } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: false } } as HookContext);
		await wait(DEBOUNCE_WAIT_MS);

		assert.deepStrictEqual(h.increments, [ 4 ]);
	}).timeout(10000);

	it('reads the stored value as MySQL returns it, a 0/1 tinyint', async () => {
		const h = harness(1, [ { id: 5, notified: true } ]);
		const ctx = h.context({ data: { meetingsOnly: true } });

		await rememberMeetingsOnly(ctx);
		await resendInvitesOnMeetingsOnlyChange({ ...ctx, result: { meetingsOnly: true } } as HookContext);

		assert.strictEqual(h.meetingLookups, 0, 'tinyint 1 is the same as true, nothing changed');
	});
});
