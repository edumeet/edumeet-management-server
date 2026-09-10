import assert from 'assert';

import { extractIcs } from '../../src/invites/replyPoller';

const ICS = [
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'METHOD:REPLY',
	'BEGIN:VEVENT',
	'UID:uid-1@meet.example.edu',
	'SEQUENCE:3',
	'DTSTAMP:20260910T090000Z',
	'ORGANIZER;CN="Piotr Pawałowski":mailto:invitation@example.com',
	'ATTENDEE;PARTSTAT=ACCEPTED;CN="Piotr Pawałowski":mailto:guest@example.org',
	'END:VEVENT',
	'END:VCALENDAR'
].join('\r\n');

const wrap = (cte: string, body: string): string => [
	'From: guest@example.org',
	'Content-Type: multipart/mixed; boundary="b1"',
	'',
	'--b1',
	'Content-Type: text/plain; charset=utf-8',
	'Content-Transfer-Encoding: 7bit',
	'',
	'Accepted.',
	'--b1',
	'Content-Type: text/calendar; charset=utf-8; method=REPLY',
	`Content-Transfer-Encoding: ${cte}`,
	'',
	body,
	'--b1--',
	''
].join('\r\n');

const toBase64 = (text: string): string => {
	const b64 = Buffer.from(text, 'utf8').toString('base64');
	const lines: string[] = [];

	for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));

	return lines.join('\r\n');
};

// what a client emits when the ICS is not 7-bit clean: "=" escaped, non-ASCII as bytes,
// and long lines broken with a soft "=" terminator
const toQuotedPrintable = (text: string): string => {
	const escaped = Buffer.from(text, 'utf8').reduce((acc, byte) => {
		if (byte === 0x3d) return `${acc}=3D`;
		if (byte === 0x0d || byte === 0x0a) return acc + String.fromCharCode(byte);
		if (byte < 0x20 || byte > 0x7e) return `${acc}=${byte.toString(16).toUpperCase()
			.padStart(2, '0')}`;

		return acc + String.fromCharCode(byte);
	}, '');

	return escaped.split('\r\n')
		.map((line) => (line.length > 70 ? `${line.slice(0, 70)}=\r\n${line.slice(70)}` : line))
		.join('\r\n');
};

const partstatOf = (ics: string): string | undefined => ics.match(/PARTSTAT=([A-Z-]+)/)?.[1];

describe('reply ICS extraction', () => {
	it('finds an unencoded calendar part', () => {
		const found = extractIcs(wrap('7bit', ICS));

		assert.ok(found);
		assert.strictEqual(partstatOf(found as string), 'ACCEPTED');
	});

	it('decodes a base64 calendar part', () => {
		const found = extractIcs(wrap('base64', toBase64(ICS)));

		assert.ok(found);
		assert.strictEqual(partstatOf(found as string), 'ACCEPTED');
	});

	it('decodes a quoted-printable calendar part', () => {
		const source = wrap('quoted-printable', toQuotedPrintable(ICS));

		// the raw source looks like it contains the ICS, which is exactly the trap
		assert.ok(source.includes('BEGIN:VCALENDAR'));
		assert.ok(source.includes('PARTSTAT=3DACCEPTED'));

		const found = extractIcs(source);

		assert.ok(found);
		assert.strictEqual(
			partstatOf(found as string),
			'ACCEPTED',
			'an undecoded quoted-printable part yields PARTSTAT=3DACCEPTED, which loses the RSVP'
		);
	});

	it('restores non-ASCII names from quoted-printable', () => {
		const found = extractIcs(wrap('quoted-printable', toQuotedPrintable(ICS)));

		assert.ok((found as string).includes('Pawałowski'), found as string);
	});

	it('rejoins soft line breaks so no property is truncated', () => {
		const found = extractIcs(wrap('quoted-printable', toQuotedPrintable(ICS)));

		assert.ok((found as string).includes('mailto:guest@example.org'), found as string);
		assert.ok(!(found as string).includes('=\r\n'), 'soft breaks must be gone');
	});

	it('prefers the REPLY when the original REQUEST rides along as an attachment', () => {
		// decoded attachments are searched before the raw source, so without an explicit
		// preference the attached REQUEST would win and the reply would be refused forever
		const request = ICS.replace('METHOD:REPLY', 'METHOD:REQUEST');
		const source = [
			'Content-Type: multipart/mixed; boundary="b1"',
			'',
			'--b1',
			'Content-Type: text/calendar; charset=utf-8; method=REPLY',
			'Content-Transfer-Encoding: 7bit',
			'',
			ICS,
			'--b1',
			'Content-Type: application/ics; name="invite.ics"',
			'Content-Transfer-Encoding: base64',
			'',
			toBase64(request),
			'--b1--',
			''
		].join('\r\n');

		const found = extractIcs(source) as string;

		assert.match(found, /^METHOD:REPLY$/m, 'the REPLY must win over an attached REQUEST');
	});

	it('still returns a lone REQUEST so the caller can refuse it explicitly', () => {
		const request = ICS.replace('METHOD:REPLY', 'METHOD:REQUEST');
		const found = extractIcs(wrap('7bit', request)) as string;

		assert.match(found, /^METHOD:REQUEST$/m);
	});

	it('returns null when there is no calendar part at all', () => {
		assert.strictEqual(extractIcs(wrap('7bit', 'just a note')), null);
	});

	it('survives a corrupt base64 part and still finds a later valid one', () => {
		const source = [
			'Content-Type: multipart/mixed; boundary="b1"',
			'',
			'--b1',
			'Content-Transfer-Encoding: base64',
			'',
			'!!!!not base64!!!!',
			'--b1',
			'Content-Type: text/calendar',
			'Content-Transfer-Encoding: base64',
			'',
			toBase64(ICS),
			'--b1--',
			''
		].join('\r\n');

		const found = extractIcs(source);

		assert.ok(found);
		assert.strictEqual(partstatOf(found as string), 'ACCEPTED');
	});
});
