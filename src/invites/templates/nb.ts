import { InviteStrings } from './types';

export const nbStrings: InviteStrings = {
	subjectRequest: (title) => `Invitasjon: ${title}`,
	subjectCancel: (title) => `Avlyst: ${title}`,
	invited: (organizerName) => `Du er invitert til et møte${organizerName ? ` av ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Møtet "${title}" er avlyst${organizerName ? ` av ${organizerName}` : ''}.`,
	title: 'Tittel: ',
	description: 'Beskrivelse: ',
	starts: 'Starter: ',
	ends: 'Slutter: ',
	join: 'Bli med: ',
	joinButton: 'Bli med i møtet',
	managedBy: 'Denne invitasjonen administreres av edumeet. Godta eller avslå fra kalenderen din for å varsle arrangøren.',
	calendarUpdates: 'Kalenderen din oppdateres automatisk.'
};
