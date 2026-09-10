import assert from 'assert';

import { getStrings, getTemplate, templateLocales } from '../../src/invites/templates';
import type { InviteContext } from '../../src/invites/templates';

const ctx = (over: Partial<InviteContext> = {}): InviteContext => ({
	title: 'Board review',
	description: 'Quarterly numbers\nBring the deck',
	roomUrl: 'https://meet.example.edu/board',
	organizerName: 'Alice Organizer',
	startsAt: 'Thursday, 10 September 2026, 12:00 CEST',
	endsAt: 'Thursday, 10 September 2026, 13:00 CEST',
	...over
});

const HOSTILE = '<script>alert(1)</script> & "quotes" \'apostrophe\'';

describe('invite templates', () => {
	it('ship the same 22 locales the client offers', () => {
		assert.deepStrictEqual(templateLocales().sort(), [
			'cn', 'cs', 'de', 'dk', 'el', 'en', 'es', 'fr', 'hi', 'hr', 'hu',
			'it', 'kk', 'lv', 'nb', 'pl', 'pt', 'ro', 'ru', 'tr', 'tw', 'uk'
		]);
	});

	for (const locale of templateLocales()) {
		describe(locale, () => {
			const t = getTemplate(locale);
			const s = getStrings(locale);

			it('has every string filled in', () => {
				for (const key of [ 'title', 'description', 'starts', 'ends', 'join', 'joinButton', 'managedBy', 'calendarUpdates' ] as const) {
					assert.ok(s[key].trim().length > 0, `${key} empty`);
				}
				assert.ok(s.invited('X').includes('X'));
				assert.ok(s.invited(undefined).length > 0);
				assert.ok(s.cancelled('T', 'X').includes('T') && s.cancelled('T', 'X').includes('X'));
			});

			it('renders the plain body with every field and the join url', () => {
				const text = t.bodyRequest(ctx());

				assert.ok(text.startsWith(s.invited('Alice Organizer')));
				assert.ok(text.includes(`${s.title}Board review`));
				assert.ok(text.includes(`${s.description}Quarterly numbers`));
				assert.ok(text.includes(`${s.join}https://meet.example.edu/board`));
				assert.ok(text.endsWith(s.managedBy));
				assert.ok(!text.includes('${'), 'a template literal leaked through unrendered');
			});

			it('renders an HTML body with a join button and the raw link', () => {
				const html = t.htmlRequest(ctx());

				assert.ok(html.includes('<h2') && html.includes('Board review'));
				assert.strictEqual(html.split('href="https://meet.example.edu/board"').length, 3, 'button plus visible link');
				assert.ok(html.includes(`>${s.joinButton}</a>`));
				assert.ok(html.includes('Quarterly numbers<br>Bring the deck'), 'description newlines become <br>');
				assert.ok(html.includes(s.managedBy.replace(/'/g, '&#39;')));
			});

			it('renders the cancellation in both forms', () => {
				const text = t.bodyCancel(ctx());
				const html = t.htmlCancel(ctx());

				assert.ok(text.startsWith(s.cancelled('Board review', 'Alice Organizer')));
				assert.ok(text.endsWith(s.calendarUpdates));
				assert.ok(html.includes('Board review'));
				assert.ok(html.includes(s.calendarUpdates.replace(/'/g, '&#39;')));
			});

			it('puts the join link into the calendar description in both forms', () => {
				const d = t.eventDescription(ctx());

				assert.ok(d.plain.includes(`${s.join}https://meet.example.edu/board`));
				assert.ok(d.plain.startsWith('Quarterly numbers'));
				assert.ok(d.html.includes('href="https://meet.example.edu/board"'));
				assert.ok(d.html.includes(`>${s.joinButton}</a>`));
			});
		});
	}

	describe('escaping', () => {
		const t = getTemplate('en');

		it('escapes user-controlled fields in the HTML body', () => {
			const html = t.htmlRequest(ctx({ title: HOSTILE, description: HOSTILE, organizerName: HOSTILE }));

			assert.ok(!html.includes('<script>'));
			assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot; &#39;apostrophe&#39;'));
		});

		it('escapes the same fields in the cancellation and the calendar description', () => {
			assert.ok(!t.htmlCancel(ctx({ title: HOSTILE })).includes('<script>'));
			assert.ok(!t.eventDescription(ctx({ description: HOSTILE })).html.includes('<script>'));
		});

		it('escapes the join url inside href and text alike', () => {
			const html = t.htmlRequest(ctx({ roomUrl: 'https://meet.example.edu/a"b' }));

			assert.ok(!html.includes('/a"b'));
			assert.ok(html.includes('href="https://meet.example.edu/a&quot;b"'));
		});

		it('leaves the plain-text body unescaped', () => {
			assert.ok(t.bodyRequest(ctx({ title: HOSTILE })).includes(HOSTILE));
		});
	});

	describe('without a description', () => {
		const t = getTemplate('en');

		it('omits the description row everywhere', () => {
			for (const description of [ undefined, '', '   ' ]) {
				assert.ok(!t.bodyRequest(ctx({ description })).includes('Description:'));
				assert.ok(!t.htmlRequest(ctx({ description })).includes('Description:'));
			}
		});

		it('starts the calendar description with the join line', () => {
			const d = t.eventDescription(ctx({ description: '' }));

			assert.ok(d.plain.startsWith('Join: https://meet.example.edu/board'));
			assert.ok(!d.plain.startsWith('\n'));
			assert.ok(d.html.startsWith('<p style="margin:0 0 12px"><a href='));
		});
	});

	describe('without an organizer name', () => {
		it('still renders a complete sentence in every locale', () => {
			for (const locale of templateLocales()) {
				const t = getTemplate(locale);
				const text = t.bodyRequest(ctx({ organizerName: undefined }));

				assert.ok(!text.includes('undefined'), locale);
				assert.ok(!t.htmlRequest(ctx({ organizerName: undefined })).includes('undefined'), locale);
				assert.ok(!t.bodyCancel(ctx({ organizerName: undefined })).includes('undefined'), locale);
			}
		});
	});
});
