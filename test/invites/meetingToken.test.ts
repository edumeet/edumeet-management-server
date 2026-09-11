import assert from 'assert';

import {
	generateMeetingToken,
	MEETING_TOKEN_ALPHABET,
	MEETING_TOKEN_LENGTH
} from '../../src/services/meetings/meetingToken';

describe('meeting token', () => {
	it('is twelve characters from the unambiguous alphabet', () => {
		for (let i = 0; i < 500; i++) {
			const token = generateMeetingToken();

			assert.strictEqual(token.length, MEETING_TOKEN_LENGTH);
			for (const ch of token) assert.ok(MEETING_TOKEN_ALPHABET.includes(ch), `unexpected character ${ch}`);
		}
	});

	it('never contains the characters people confuse when typing', () => {
		for (const ch of '0O1Il') assert.ok(!MEETING_TOKEN_ALPHABET.includes(ch), `${ch} must not be in the alphabet`);
	});

	it('draws without modulo bias, so the alphabet length divides 256', () => {
		assert.strictEqual(256 % MEETING_TOKEN_ALPHABET.length, 0);
	});

	it('does not repeat across a large sample', () => {
		const seen = new Set<string>();

		for (let i = 0; i < 20000; i++) seen.add(generateMeetingToken());

		assert.strictEqual(seen.size, 20000);
	});
});
