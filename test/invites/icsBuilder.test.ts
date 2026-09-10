import assert from 'assert';

import { buildRequestIcs, buildCancelIcs } from '../../src/invites/icsBuilder';
import type { Meeting } from '../../src/services/meetings/meetings.schema';
import type { MeetingAttendee } from '../../src/services/meetingAttendees/meetingAttendees.schema';
import type { TenantInviteConfig } from '../../src/services/tenantInviteConfigs/tenantInviteConfigs.schema';

const START = Date.UTC(2026, 8, 10, 10, 0, 0);
const END = Date.UTC(2026, 8, 10, 11, 0, 0);

const meeting = (over: Record<string, unknown> = {}): Meeting => ({
	id: 1,
	roomId: 1,
	tenantId: 1,
	organizerId: 1,
	uid: 'uid-1@meet.example.edu',
	sequence: 4,
	status: 'CONFIRMED',
	title: 'Board review',
	description: '',
	startsAt: START,
	endsAt: END,
	timezone: 'Europe/Warsaw',
	locale: 'en',
	createdAt: 0,
	updatedAt: 0,
	...over
} as unknown as Meeting);

const attendee = (over: Record<string, unknown> = {}): MeetingAttendee => ({
	id: 1,
	meetingId: 1,
	email: 'guest@example.org',
	name: 'Guest One',
	partstat: 'NEEDS-ACTION',
	lastNotifiedSequence: -1,
	...over
} as unknown as MeetingAttendee);

const tenantConfig = (): TenantInviteConfig => ({
	id: 1,
	tenantId: 1,
	enabled: true,
	organizerAddress: 'invitation@example.com',
	organizerName: 'Invites',
	smtpHost: 'smtp.example.com',
	smtpPort: 465,
	smtpSecure: true,
	smtpUser: 'invitation@example.com',
	smtpPass: 'x',
	createdAt: 0,
	updatedAt: 0
} as unknown as TenantInviteConfig);

const build = (over: Record<string, unknown> = {}, attendees = [ attendee() ]): string => buildRequestIcs({
	meeting: meeting(over),
	attendees,
	tenantConfig: tenantConfig(),
	roomUrl: 'https://meet.example.edu/board',
	organizerUserName: 'Alice Organizer'
});

// RFC 5545 folds long lines with CRLF plus one leading space
const unfold = (ics: string): string => ics.replace(/\r\n[ \t]/g, '');

describe('ics builder', () => {
	it('emits a REQUEST for an invite and a CANCEL for a withdrawal', () => {
		assert.match(build(), /^METHOD:REQUEST$/m);

		const cancelled = buildCancelIcs({
			meeting: meeting({ status: 'CANCELLED' }),
			attendees: [ attendee() ],
			tenantConfig: tenantConfig(),
			roomUrl: 'https://meet.example.edu/board'
		});

		assert.match(cancelled, /^METHOD:CANCEL$/m);
		assert.match(cancelled, /^STATUS:CANCELLED$/m);
	});

	describe('timestamps', () => {
		// A TZID with no accompanying VTIMEZONE block is what produced Thunderbird's
		// 80004005 previously, so the output must stay in plain UTC.
		it('writes UTC instants with no TZID', () => {
			const ics = build();

			assert.match(ics, /^DTSTART:20260910T100000Z$/m);
			assert.match(ics, /^DTEND:20260910T110000Z$/m);
			assert.ok(!ics.includes('TZID'), 'a TZID without VTIMEZONE breaks some clients');
			assert.ok(!ics.includes('BEGIN:VTIMEZONE'));
		});

		it('coerces bigint columns that arrive as strings', () => {
			// node-postgres hands back bigint as a string, and new Date(string) misreads it
			const ics = build({ startsAt: String(START), endsAt: String(END) });

			assert.match(ics, /^DTSTART:20260910T100000Z$/m);
			assert.match(ics, /^DTEND:20260910T110000Z$/m);
		});

		it('carries a DTSTAMP', () => {
			assert.match(build(), /^DTSTAMP:\d{8}T\d{6}Z$/m);
		});
	});

	describe('identity', () => {
		it('points the organizer at the mailbox that receives replies', () => {
			assert.match(unfold(build()), /^ORGANIZER;CN="Alice Organizer":mailto:invitation@example\.com$/m);
		});

		it('carries the meeting uid and sequence', () => {
			const ics = build();

			assert.match(ics, /^UID:uid-1@meet\.example\.edu$/m);
			assert.match(ics, /^SEQUENCE:4$/m);
		});

		it('uses the room url as the location', () => {
			assert.match(build(), /^LOCATION:https:\/\/meet\.example\.edu\/board$/m);
		});
	});

	describe('attendees', () => {
		it('asks for a reply on a REQUEST', () => {
			assert.match(unfold(build()), /ATTENDEE[^\r\n]*RSVP=TRUE[^\r\n]*guest@example\.org/);
		});

		it('does not ask for a reply on a CANCEL', () => {
			const ics = unfold(buildCancelIcs({
				meeting: meeting({ status: 'CANCELLED' }),
				attendees: [ attendee() ],
				tenantConfig: tenantConfig(),
				roomUrl: 'https://meet.example.edu/board'
			}));

			assert.ok(!/ATTENDEE[^\r\n]*RSVP=TRUE/.test(ics), 'there is nothing to respond to on a cancellation');
		});

		it('keeps a real display name', () => {
			assert.match(unfold(build()), /CN="Guest One"/);
		});

		it('omits a CN that just repeats the address', () => {
			const ics = unfold(build({}, [ attendee({ name: 'guest@example.org' }) ]));

			assert.ok(!ics.includes('CN="guest@example.org"'), 'an address is not a display name');
			assert.ok(ics.includes('guest@example.org'));
		});

		it('reflects a stored partstat, so an accepted guest stays accepted', () => {
			const ics = unfold(build({}, [ attendee({ partstat: 'ACCEPTED' }) ]));

			assert.match(ics, /PARTSTAT=ACCEPTED/);
		});

		it('lists every guest in each copy', () => {
			const ics = unfold(build({}, [
				attendee({ id: 1, email: 'one@example.org', name: 'One' }),
				attendee({ id: 2, email: 'two@example.org', name: 'Two' })
			]));

			assert.ok(ics.includes('one@example.org'));
			assert.ok(ics.includes('two@example.org'));
		});
	});

	describe('description', () => {
		it('omits the property entirely when there is no text', () => {
			assert.ok(!build({ description: '' }).includes('DESCRIPTION'));
			assert.ok(!build({ description: '   ' }).includes('DESCRIPTION'));
		});

		it('includes it when there is text', () => {
			assert.match(build({ description: 'Quarterly numbers' }), /^DESCRIPTION:Quarterly numbers$/m);
		});
	});

	it('produces CRLF line endings throughout', () => {
		const ics = build();

		assert.ok(!/[^\r]\n/.test(ics), 'RFC 5545 requires CRLF');
	});

	it('folds long lines without splitting a multi-byte character', () => {
		const ics = build({}, [ attendee({ name: 'Piotr Pawałowski z Politechniki Poznańskiej' }) ]);

		assert.ok(unfold(ics).includes('Piotr Pawałowski z Politechniki Poznańskiej'));
		assert.ok(!ics.includes('�'), 'a fold must not cut a UTF-8 sequence in half');
	});
});
