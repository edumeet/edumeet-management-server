import { InviteTemplate } from './types';

export const itTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invito: ${title}`,
	subjectCancel: (title) => `Annullato: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Sei stato invitato a una riunione${organizerName ? ` da ${organizerName}` : ''}.`,
		'',
		`Titolo: ${title}`,
		description ? `Descrizione: ${description}` : null,
		`Inizio: ${startsAt}`,
		`Partecipa: ${roomUrl}`,
		'',
		"Questo invito è gestito da edumeet. Accetta o rifiuta dal tuo calendario per informare l'organizzatore."
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`La riunione "${title}" è stata annullata${organizerName ? ` da ${organizerName}` : ''}.`,
		'',
		'Il tuo calendario verrà aggiornato automaticamente.'
	].join('\n')
};
