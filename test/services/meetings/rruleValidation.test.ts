import assert from 'assert';

import { meetingDataValidator, meetingPatchValidator } from '../../../src/services/meetings/meetings.schema';

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

	it('accepts common BY* rules', async () => {
		assert.ok(await valid('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20271231T235959Z'));
		assert.ok(await valid('FREQ=MONTHLY;BYDAY=-1FR'));
		assert.ok(await valid('FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=1;WKST=MO'));
	});

	it('refuses sub-daily rules and BY* parts that multiply the occurrences', async () => {
		for (const rrule of [ 'FREQ=SECONDLY', 'FREQ=MINUTELY;COUNT=5', 'FREQ=HOURLY', 'FREQ=DAILY;BYHOUR=1,2', 'FREQ=DAILY;BYSECOND=0,1' ])
			assert.strictEqual(await valid(rrule), false, rrule);
	});

	it('refuses a rule that would add lines to the invitation', async () => {
		assert.strictEqual(await valid('FREQ=DAILY\r\nATTENDEE:mailto:x@example.org'), false);
		assert.strictEqual(await valid('FREQ=DAILY;COUNT=2\nX'), false);
	});

	it('checks the rule on create too', async () => {
		await assert.rejects(meetingDataValidator({
			roomId: 1, title: 't', startsAt: 0, endsAt: 1, timezone: 'UTC', rrule: 'FREQ=SECONDLY'
		}));
	});
});
