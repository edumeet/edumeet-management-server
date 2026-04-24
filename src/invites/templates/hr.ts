import { InviteTemplate } from './types';

export const hrTemplate: InviteTemplate = {
	subjectRequest: (title) => `Poziv: ${title}`,
	subjectCancel: (title) => `Otkazano: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Pozvani ste na sastanak${organizerName ? ` od ${organizerName}` : ''}.`,
		'',
		`Naslov: ${title}`,
		description ? `Opis: ${description}` : null,
		`Početak: ${startsAt}`,
		`Pridruži se: ${roomUrl}`,
		'',
		'Ovim pozivom upravlja edumeet. Prihvatite ili odbijte iz svog kalendara kako biste obavijestili organizatora.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Sastanak "${title}" je otkazan${organizerName ? ` od ${organizerName}` : ''}.`,
		'',
		'Vaš kalendar će se automatski ažurirati.'
	].join('\n')
};
