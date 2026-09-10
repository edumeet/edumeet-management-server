import { InviteStrings } from './types';

export const hrStrings: InviteStrings = {
	subjectRequest: (title) => `Poziv: ${title}`,
	subjectCancel: (title) => `Otkazano: ${title}`,
	invited: (organizerName) => `Pozvani ste na sastanak${organizerName ? ` od ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Sastanak "${title}" je otkazan${organizerName ? ` od ${organizerName}` : ''}.`,
	title: 'Naslov: ',
	description: 'Opis: ',
	starts: 'Početak: ',
	ends: 'Kraj: ',
	join: 'Pridruži se: ',
	joinButton: 'Pridruži se sastanku',
	managedBy: 'Ovim pozivom upravlja edumeet. Prihvatite ili odbijte iz svog kalendara kako biste obavijestili organizatora.',
	calendarUpdates: 'Vaš kalendar će se automatski ažurirati.'
};
