import { InviteStrings } from './types';

export const csStrings: InviteStrings = {
	subjectRequest: (title) => `Pozvánka: ${title}`,
	subjectCancel: (title) => `Zrušeno: ${title}`,
	invited: (organizerName) => `Byli jste pozváni na schůzku${organizerName ? ` uživatelem ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Schůzka "${title}" byla zrušena${organizerName ? ` uživatelem ${organizerName}` : ''}.`,
	title: 'Název: ',
	description: 'Popis: ',
	starts: 'Začátek: ',
	ends: 'Konec: ',
	join: 'Připojit se: ',
	joinButton: 'Připojit se ke schůzce',
	managedBy: 'Toto pozvání je spravováno systémem edumeet. Přijměte nebo odmítněte ve svém kalendáři, abyste informovali organizátora.',
	calendarUpdates: 'Váš kalendář bude aktualizován automaticky.'
};
