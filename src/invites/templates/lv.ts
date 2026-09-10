import { InviteStrings } from './types';

export const lvStrings: InviteStrings = {
	subjectRequest: (title) => `Uzaicinājums: ${title}`,
	subjectCancel: (title) => `Atcelts: ${title}`,
	invited: (organizerName) => `Jūs esat uzaicināts uz sanāksmi${organizerName ? `, ko organizē ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Sanāksme "${title}" ir atcelta${organizerName ? `, ko atcēla ${organizerName}` : ''}.`,
	title: 'Nosaukums: ',
	description: 'Apraksts: ',
	starts: 'Sākums: ',
	ends: 'Beigas: ',
	join: 'Pievienoties: ',
	joinButton: 'Pievienoties sanāksmei',
	managedBy: 'Šo uzaicinājumu pārvalda edumeet. Apstipriniet vai atsakiet kalendārā, lai informētu organizatoru.',
	calendarUpdates: 'Jūsu kalendārs tiks atjaunināts automātiski.'
};
