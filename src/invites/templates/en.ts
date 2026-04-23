import { InviteTemplate } from './types';

export const enTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invitation: ${title}`,
	subjectCancel: (title) => `Cancelled: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`You've been invited to a meeting${organizerName ? ` by ${organizerName}` : ''}.`,
		'',
		`Title: ${title}`,
		description ? `Description: ${description}` : null,
		`Starts: ${startsAt}`,
		`Join: ${roomUrl}`,
		'',
		'This invitation is managed by edumeet. Accept or decline from your calendar to update the organizer.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`The meeting "${title}" has been cancelled${organizerName ? ` by ${organizerName}` : ''}.`,
		'',
		'Your calendar will be updated automatically.'
	].join('\n')
};
