import { InviteTemplate } from './types';

export const huTemplate: InviteTemplate = {
	subjectRequest: (title) => `Meghívó: ${title}`,
	subjectCancel: (title) => `Lemondva: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Meghívást kapott egy megbeszélésre${organizerName ? ` ${organizerName} részéről` : ''}.`,
		'',
		`Cím: ${title}`,
		description ? `Leírás: ${description}` : null,
		`Kezdés: ${startsAt}`,
		`Csatlakozás: ${roomUrl}`,
		'',
		'Ezt a meghívót az edumeet kezeli. Fogadja el vagy utasítsa el a naptárában, hogy értesítse a szervezőt.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`A "${title}" megbeszélést lemondták${organizerName ? ` ${organizerName} által` : ''}.`,
		'',
		'A naptára automatikusan frissülni fog.'
	].join('\n')
};
