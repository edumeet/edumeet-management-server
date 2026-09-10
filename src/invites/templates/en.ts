import { InviteStrings } from './types';

export const enStrings: InviteStrings = {
	subjectRequest: (title) => `Invitation: ${title}`,
	subjectCancel: (title) => `Cancelled: ${title}`,
	invited: (organizerName) => `You've been invited to a meeting${organizerName ? ` by ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `The meeting "${title}" has been cancelled${organizerName ? ` by ${organizerName}` : ''}.`,
	title: 'Title: ',
	description: 'Description: ',
	starts: 'Starts: ',
	ends: 'Ends: ',
	join: 'Join: ',
	joinButton: 'Join meeting',
	managedBy: 'This invitation is managed by edumeet. Accept or decline from your calendar to update the organizer.',
	calendarUpdates: 'Your calendar will be updated automatically.'
};
