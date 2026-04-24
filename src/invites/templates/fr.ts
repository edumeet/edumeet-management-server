import { InviteTemplate } from './types';

export const frTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invitation : ${title}`,
	subjectCancel: (title) => `Annulé : ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Vous avez été invité(e) à une réunion${organizerName ? ` par ${organizerName}` : ''}.`,
		'',
		`Titre : ${title}`,
		description ? `Description : ${description}` : null,
		`Début : ${startsAt}`,
		`Rejoindre : ${roomUrl}`,
		'',
		"Cette invitation est gérée par edumeet. Acceptez ou refusez depuis votre calendrier pour informer l'organisateur."
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`La réunion « ${title} » a été annulée${organizerName ? ` par ${organizerName}` : ''}.`,
		'',
		'Votre calendrier sera mis à jour automatiquement.'
	].join('\n')
};
