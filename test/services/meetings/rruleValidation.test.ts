import assert from 'assert';

import { meetingDataValidator, meetingExternalResolver, meetingPatchValidator } from '../../../src/services/meetings/meetings.schema';
import type { HookContext } from '../../../src/declarations';

const valid = async (rrule: string) => {
	try {
		await meetingPatchValidator({ rrule });

		return true;
	} catch {
		return false;
	}
};

describe('meeting rrule validation', () => {
	it('accepts the rules the meeting dialog writes', async () => {
		for (const freq of [ 'DAILY', 'WEEKLY', 'MONTHLY' ])
			assert.ok(await valid(`FREQ=${freq};INTERVAL=2;COUNT=10`), freq);
	});

	it('accepts weekday rules', async () => {
		assert.ok(await valid('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20271231T235959Z'));
		assert.ok(await valid('FREQ=MONTHLY;BYDAY=-1FR;COUNT=6'));
		assert.ok(await valid('FREQ=YEARLY;INTERVAL=2;WKST=MO;UNTIL=20301231'));
	});

	it('refuses parts with which a rule can match nothing', async () => {
		for (const rrule of [ 'FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30', 'FREQ=MONTHLY;BYSETPOS=40', 'FREQ=MONTHLY;BYDAY=53MO' ])
			assert.strictEqual(await valid(rrule), false, rrule);
	});

	it('refuses sub-daily rules and BY* parts that multiply the occurrences', async () => {
		for (const rrule of [ 'FREQ=SECONDLY', 'FREQ=MINUTELY;COUNT=5', 'FREQ=HOURLY', 'FREQ=DAILY;BYHOUR=1,2', 'FREQ=DAILY;BYSECOND=0,1' ])
			assert.strictEqual(await valid(rrule), false, rrule);
	});

	it('refuses a rule that would add lines to the invitation', async () => {
		assert.strictEqual(await valid('FREQ=DAILY\r\nATTENDEE:mailto:x@example.org'), false);
		assert.strictEqual(await valid('FREQ=DAILY;COUNT=2\nX'), false);
	});

	it('refuses a rule without an end, or with one from 2100 on', async () => {
		for (const rrule of [ 'FREQ=WEEKLY', 'FREQ=DAILY;INTERVAL=2', 'FREQ=WEEKLY;BYDAY=MO;WKST=MO', 'FREQ=DAILY;UNTIL=21000101', 'FREQ=DAILY;UNTIL=99991231T000000Z' ])
			assert.strictEqual(await valid(rrule), false, rrule);
		assert.ok(await valid('FREQ=DAILY;UNTIL=20991231T235959Z'));
	});

	it('checks the rule on create too', async () => {
		await assert.rejects(meetingDataValidator({
			roomId: 1, title: 't', startsAt: 0, endsAt: 1, timezone: 'UTC', rrule: 'FREQ=SECONDLY'
		}));
	});

	it('refuses meeting times before 2000 or after 2100', async () => {
		for (const startsAt of [ 0, -1e12, Date.UTC(2101, 0, 1) ])
			await assert.rejects(meetingPatchValidator({ startsAt }), String(startsAt));
		await meetingPatchValidator({ startsAt: Date.UTC(2026, 10, 10), endsAt: Date.UTC(2026, 10, 10, 1) });
	});

	it('refuses a BYDAY sign without an ordinal', async () => {
		assert.strictEqual(await valid('FREQ=WEEKLY;BYDAY=+MO'), false);
		assert.ok(await valid('FREQ=MONTHLY;BYDAY=+2MO;COUNT=3'));
	});

	it('does not hand out a stored rule or start the limits refuse, so clients do not expand it', async () => {
		const resolve = (meeting: Record<string, unknown>) =>
			meetingExternalResolver.resolve(meeting as never, {} as HookContext) as Promise<Record<string, unknown>>;
		const ok = { startsAt: Date.UTC(2026, 0, 1), endsAt: Date.UTC(2026, 0, 1, 1) };

		assert.strictEqual((await resolve({ ...ok, rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=3' })).rrule, 'FREQ=WEEKLY;INTERVAL=1;COUNT=3');
		assert.strictEqual((await resolve({ ...ok, rrule: 'FREQ=SECONDLY' })).rrule, undefined);
		assert.strictEqual((await resolve({ startsAt: 0, endsAt: 1000, rrule: 'FREQ=DAILY' })).rrule, undefined);
		assert.strictEqual((await resolve({ ...ok, rrule: 'FREQ=WEEKLY;INTERVAL=1' })).rrule, undefined);
	});
});
