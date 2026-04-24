import { InviteTemplate } from './types';

export const plTemplate: InviteTemplate = {
	subjectRequest: (title) => `Zaproszenie: ${title}`,
	subjectCancel: (title) => `Odwołane: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Zostałeś zaproszony na spotkanie${organizerName ? ` przez ${organizerName}` : ''}.`,
		'',
		`Tytuł: ${title}`,
		description ? `Opis: ${description}` : null,
		`Rozpoczęcie: ${startsAt}`,
		`Dołącz: ${roomUrl}`,
		'',
		'To zaproszenie jest zarządzane przez edumeet. Zaakceptuj lub odrzuć w swoim kalendarzu, aby powiadomić organizatora.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Spotkanie "${title}" zostało odwołane${organizerName ? ` przez ${organizerName}` : ''}.`,
		'',
		'Twój kalendarz zostanie zaktualizowany automatycznie.'
	].join('\n')
};
