import { EventDescription, InviteContext, InviteStrings, InviteTemplate } from './types';

const escapeHtml = (s: string): string => s
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const multiline = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>');

const BUTTON = 'display:inline-block;background:#1976d2;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px';
const LINK = 'color:#1976d2';
const MUTED = 'color:#666666';

const joinBlock = (s: InviteStrings, roomUrl: string): string => {
	const url = escapeHtml(roomUrl);

	return [
		`<p style="margin:0 0 12px"><a href="${url}" style="${BUTTON}">${escapeHtml(s.joinButton)}</a></p>`,
		`<p style="margin:0 0 24px;font-size:13px;${MUTED}"><a href="${url}" style="${LINK}">${url}</a></p>`
	].join('');
};

const row = (label: string, value: string): string => [
	`<tr><td style="padding:4px 12px 4px 0;${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(label.trim())}</td>`,
	`<td style="padding:4px 0">${value}</td></tr>`
].join('');

const page = (...inner: string[]): string => [
	'<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:560px;margin:0 auto;padding:24px">',
	...inner,
	'</div>'
].join('');

const footer = (text: string): string =>
	`<p style="margin:0;font-size:12px;color:#888888;border-top:1px solid #e0e0e0;padding-top:12px">${escapeHtml(text)}</p>`;

const hasText = (v?: string): v is string => Boolean(v && v.trim());

// Every locale file only supplies wording; both bodies, the HTML and the calendar
// description come out of here so they can never drift apart between languages.
export const fromStrings = (s: InviteStrings): InviteTemplate => ({
	subjectRequest: s.subjectRequest,
	subjectCancel: s.subjectCancel,

	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt, endsAt }: InviteContext) => [
		s.invited(organizerName),
		'',
		`${s.title}${title}`,
		hasText(description) ? `${s.description}${description}` : null,
		`${s.starts}${startsAt}`,
		`${s.ends}${endsAt}`,
		`${s.join}${roomUrl}`,
		'',
		s.managedBy
	].filter((line) => line !== null).join('\n'),

	bodyCancel: ({ title, organizerName }: InviteContext) => [
		s.cancelled(title, organizerName),
		'',
		s.calendarUpdates
	].join('\n'),

	htmlRequest: ({ title, description, roomUrl, organizerName, startsAt, endsAt }: InviteContext) => page(
		`<p style="margin:0 0 16px">${escapeHtml(s.invited(organizerName))}</p>`,
		`<h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h2>`,
		'<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">',
		row(s.starts, escapeHtml(startsAt)),
		row(s.ends, escapeHtml(endsAt)),
		hasText(description) ? row(s.description, multiline(description)) : '',
		'</table>',
		joinBlock(s, roomUrl),
		footer(s.managedBy)
	),

	htmlCancel: ({ title, organizerName }: InviteContext) => page(
		`<p style="margin:0 0 16px">${escapeHtml(s.cancelled(title, organizerName))}</p>`,
		footer(s.calendarUpdates)
	),

	eventDescription: ({ description, roomUrl }: InviteContext): EventDescription => ({
		plain: [
			hasText(description) ? description : null,
			hasText(description) ? '' : null,
			`${s.join}${roomUrl}`,
			'',
			s.managedBy
		].filter((line) => line !== null).join('\n'),
		html: [
			hasText(description) ? `<p>${multiline(description)}</p>` : '',
			joinBlock(s, roomUrl),
			`<p style="font-size:12px;color:#888888">${escapeHtml(s.managedBy)}</p>`
		].join('')
	})
});
