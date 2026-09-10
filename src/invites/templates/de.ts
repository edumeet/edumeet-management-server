import { InviteStrings } from './types';

export const deStrings: InviteStrings = {
	subjectRequest: (title) => `Einladung: ${title}`,
	subjectCancel: (title) => `Abgesagt: ${title}`,
	invited: (organizerName) => `Sie wurden zu einer Besprechung eingeladen${organizerName ? ` von ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Die Besprechung "${title}" wurde abgesagt${organizerName ? ` von ${organizerName}` : ''}.`,
	title: 'Titel: ',
	description: 'Beschreibung: ',
	starts: 'Beginn: ',
	ends: 'Ende: ',
	join: 'Teilnehmen: ',
	joinButton: 'An der Besprechung teilnehmen',
	managedBy: 'Diese Einladung wird von edumeet verwaltet. Nehmen Sie über Ihren Kalender an oder lehnen Sie ab, um den Organisator zu informieren.',
	calendarUpdates: 'Ihr Kalender wird automatisch aktualisiert.'
};
