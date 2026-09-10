import { InviteStrings } from './types';

export const huStrings: InviteStrings = {
	subjectRequest: (title) => `Meghívó: ${title}`,
	subjectCancel: (title) => `Lemondva: ${title}`,
	invited: (organizerName) => `Meghívást kapott egy megbeszélésre${organizerName ? ` ${organizerName} részéről` : ''}.`,
	cancelled: (title, organizerName) => `A "${title}" megbeszélést lemondták${organizerName ? ` ${organizerName} által` : ''}.`,
	title: 'Cím: ',
	description: 'Leírás: ',
	starts: 'Kezdés: ',
	ends: 'Befejezés: ',
	join: 'Csatlakozás: ',
	joinButton: 'Csatlakozás a megbeszéléshez',
	managedBy: 'Ezt a meghívót az edumeet kezeli. Fogadja el vagy utasítsa el a naptárában, hogy értesítse a szervezőt.',
	calendarUpdates: 'A naptára automatikusan frissülni fog.'
};
