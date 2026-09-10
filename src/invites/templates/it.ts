import { InviteStrings } from './types';

export const itStrings: InviteStrings = {
	subjectRequest: (title) => `Invito: ${title}`,
	subjectCancel: (title) => `Annullato: ${title}`,
	invited: (organizerName) => `Sei stato invitato a una riunione${organizerName ? ` da ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `La riunione "${title}" è stata annullata${organizerName ? ` da ${organizerName}` : ''}.`,
	title: 'Titolo: ',
	description: 'Descrizione: ',
	starts: 'Inizio: ',
	ends: 'Fine: ',
	join: 'Partecipa: ',
	joinButton: 'Partecipa alla riunione',
	managedBy: "Questo invito è gestito da edumeet. Accetta o rifiuta dal tuo calendario per informare l'organizzatore.",
	calendarUpdates: 'Il tuo calendario verrà aggiornato automaticamente.'
};
