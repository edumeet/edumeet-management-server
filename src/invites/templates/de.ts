import { InviteTemplate } from './types';

export const deTemplate: InviteTemplate = {
	subjectRequest: (title) => `Einladung: ${title}`,
	subjectCancel: (title) => `Abgesagt: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Sie wurden zu einer Besprechung eingeladen${organizerName ? ` von ${organizerName}` : ''}.`,
		'',
		`Titel: ${title}`,
		description ? `Beschreibung: ${description}` : null,
		`Beginn: ${startsAt}`,
		`Teilnehmen: ${roomUrl}`,
		'',
		'Diese Einladung wird von edumeet verwaltet. Nehmen Sie über Ihren Kalender an oder lehnen Sie ab, um den Organisator zu informieren.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Die Besprechung "${title}" wurde abgesagt${organizerName ? ` von ${organizerName}` : ''}.`,
		'',
		'Ihr Kalender wird automatisch aktualisiert.'
	].join('\n')
};
