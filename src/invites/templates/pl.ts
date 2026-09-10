import { InviteStrings } from './types';

export const plStrings: InviteStrings = {
	subjectRequest: (title) => `Zaproszenie: ${title}`,
	subjectCancel: (title) => `Odwołane: ${title}`,
	invited: (organizerName) => `Zostałeś zaproszony na spotkanie${organizerName ? ` przez ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Spotkanie "${title}" zostało odwołane${organizerName ? ` przez ${organizerName}` : ''}.`,
	title: 'Tytuł: ',
	description: 'Opis: ',
	starts: 'Rozpoczęcie: ',
	ends: 'Zakończenie: ',
	join: 'Dołącz: ',
	joinButton: 'Dołącz do spotkania',
	managedBy: 'To zaproszenie jest zarządzane przez edumeet. Zaakceptuj lub odrzuć w swoim kalendarzu, aby powiadomić organizatora.',
	calendarUpdates: 'Twój kalendarz zostanie zaktualizowany automatycznie.'
};
