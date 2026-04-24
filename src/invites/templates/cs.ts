import { InviteTemplate } from './types';

export const csTemplate: InviteTemplate = {
	subjectRequest: (title) => `Pozvánka: ${title}`,
	subjectCancel: (title) => `Zrušeno: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Byli jste pozváni na schůzku${organizerName ? ` uživatelem ${organizerName}` : ''}.`,
		'',
		`Název: ${title}`,
		description ? `Popis: ${description}` : null,
		`Začátek: ${startsAt}`,
		`Připojit se: ${roomUrl}`,
		'',
		'Toto pozvání je spravováno systémem edumeet. Přijměte nebo odmítněte ve svém kalendáři, abyste informovali organizátora.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Schůzka "${title}" byla zrušena${organizerName ? ` uživatelem ${organizerName}` : ''}.`,
		'',
		'Váš kalendář bude aktualizován automaticky.'
	].join('\n')
};
