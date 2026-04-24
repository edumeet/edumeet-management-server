import { InviteTemplate } from './types';

export const dkTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invitation: ${title}`,
	subjectCancel: (title) => `Aflyst: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Du er blevet inviteret til et møde${organizerName ? ` af ${organizerName}` : ''}.`,
		'',
		`Titel: ${title}`,
		description ? `Beskrivelse: ${description}` : null,
		`Start: ${startsAt}`,
		`Deltag: ${roomUrl}`,
		'',
		'Denne invitation styres af edumeet. Accepter eller afvis i din kalender for at informere arrangøren.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Mødet "${title}" er blevet aflyst${organizerName ? ` af ${organizerName}` : ''}.`,
		'',
		'Din kalender opdateres automatisk.'
	].join('\n')
};
