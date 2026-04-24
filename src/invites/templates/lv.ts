import { InviteTemplate } from './types';

export const lvTemplate: InviteTemplate = {
	subjectRequest: (title) => `Uzaicinājums: ${title}`,
	subjectCancel: (title) => `Atcelts: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Jūs esat uzaicināts uz sanāksmi${organizerName ? `, ko organizē ${organizerName}` : ''}.`,
		'',
		`Nosaukums: ${title}`,
		description ? `Apraksts: ${description}` : null,
		`Sākums: ${startsAt}`,
		`Pievienoties: ${roomUrl}`,
		'',
		'Šo uzaicinājumu pārvalda edumeet. Apstipriniet vai atsakiet kalendārā, lai informētu organizatoru.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Sanāksme "${title}" ir atcelta${organizerName ? `, ko atcēla ${organizerName}` : ''}.`,
		'',
		'Jūsu kalendārs tiks atjaunināts automātiski.'
	].join('\n')
};
