import { InviteStrings } from './types';

export const dkStrings: InviteStrings = {
	subjectRequest: (title) => `Invitation: ${title}`,
	subjectCancel: (title) => `Aflyst: ${title}`,
	invited: (organizerName) => `Du er blevet inviteret til et møde${organizerName ? ` af ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Mødet "${title}" er blevet aflyst${organizerName ? ` af ${organizerName}` : ''}.`,
	title: 'Titel: ',
	description: 'Beskrivelse: ',
	starts: 'Start: ',
	ends: 'Slut: ',
	join: 'Deltag: ',
	joinButton: 'Deltag i mødet',
	managedBy: 'Denne invitation styres af edumeet. Accepter eller afvis i din kalender for at informere arrangøren.',
	calendarUpdates: 'Din kalender opdateres automatisk.'
};
