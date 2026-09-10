import { InviteStrings } from './types';

export const frStrings: InviteStrings = {
	subjectRequest: (title) => `Invitation : ${title}`,
	subjectCancel: (title) => `Annulé : ${title}`,
	invited: (organizerName) => `Vous avez été invité(e) à une réunion${organizerName ? ` par ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `La réunion « ${title} » a été annulée${organizerName ? ` par ${organizerName}` : ''}.`,
	title: 'Titre : ',
	description: 'Description : ',
	starts: 'Début : ',
	ends: 'Fin : ',
	join: 'Rejoindre : ',
	joinButton: 'Rejoindre la réunion',
	managedBy: "Cette invitation est gérée par edumeet. Acceptez ou refusez depuis votre calendrier pour informer l'organisateur.",
	calendarUpdates: 'Votre calendrier sera mis à jour automatiquement.'
};
