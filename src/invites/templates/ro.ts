import { InviteTemplate } from './types';

export const roTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invitație: ${title}`,
	subjectCancel: (title) => `Anulat: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Ați fost invitat la o întâlnire${organizerName ? ` de ${organizerName}` : ''}.`,
		'',
		`Titlu: ${title}`,
		description ? `Descriere: ${description}` : null,
		`Început: ${startsAt}`,
		`Alăturați-vă: ${roomUrl}`,
		'',
		'Această invitație este gestionată de edumeet. Acceptați sau refuzați din calendar pentru a notifica organizatorul.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Întâlnirea "${title}" a fost anulată${organizerName ? ` de ${organizerName}` : ''}.`,
		'',
		'Calendarul dvs. va fi actualizat automat.'
	].join('\n')
};
