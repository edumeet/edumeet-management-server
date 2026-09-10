import assert from 'assert';

import { meetingAttendeeDataResolver } from '../../src/services/meetingAttendees/meetingAttendees.schema';
import type { HookContext } from '../../src/declarations';

const context = (invites: Record<string, unknown> | undefined): HookContext => ({
	params: {},
	app: { get: (k: string) => (k === 'invites' ? invites : undefined) }
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any as HookContext;

const resolveToken = async (invites: Record<string, unknown> | undefined): Promise<unknown> => {
	const resolved = await meetingAttendeeDataResolver.resolve(
		{ meetingId: 11, email: 'Guest@Example.org' },
		context(invites)
	);

	return (resolved as { rsvpToken?: unknown }).rsvpToken;
};

// The token is reserved for an RSVP-by-link flow that does not exist yet, so its secret must
// not be a hard requirement for creating attendees.
describe('rsvpToken', () => {
	it('is generated when the secret is configured', async () => {
		const token = await resolveToken({ rsvpTokenSecret: 's3cret' });

		assert.match(String(token), /^[0-9a-f]{64}$/);
	});

	it('is left empty rather than failing the create when the secret is absent', async () => {
		assert.strictEqual(await resolveToken({ encryptionKey: 'k' }), undefined);
		assert.strictEqual(await resolveToken(undefined), undefined);
	});

	it('is stable for the same meeting and address, ignoring case', async () => {
		const a = await resolveToken({ rsvpTokenSecret: 's3cret' });
		const resolved = await meetingAttendeeDataResolver.resolve(
			{ meetingId: 11, email: 'guest@example.org' },
			context({ rsvpTokenSecret: 's3cret' })
		);

		assert.strictEqual(a, (resolved as { rsvpToken?: unknown }).rsvpToken);
	});
});
