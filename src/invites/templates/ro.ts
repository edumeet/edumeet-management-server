import { InviteStrings } from './types';

export const roStrings: InviteStrings = {
	subjectRequest: (title) => `Invitație: ${title}`,
	subjectCancel: (title) => `Anulat: ${title}`,
	invited: (organizerName) => `Ați fost invitat la o întâlnire${organizerName ? ` de ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Întâlnirea "${title}" a fost anulată${organizerName ? ` de ${organizerName}` : ''}.`,
	title: 'Titlu: ',
	description: 'Descriere: ',
	starts: 'Început: ',
	ends: 'Sfârșit: ',
	join: 'Alăturați-vă: ',
	joinButton: 'Alăturați-vă întâlnirii',
	managedBy: 'Această invitație este gestionată de edumeet. Acceptați sau refuzați din calendar pentru a notifica organizatorul.',
	calendarUpdates: 'Calendarul dvs. va fi actualizat automat.'
};
