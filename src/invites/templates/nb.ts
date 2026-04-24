import { InviteTemplate } from './types';

export const nbTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invitasjon: ${title}`,
	subjectCancel: (title) => `Avlyst: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Du er invitert til et møte${organizerName ? ` av ${organizerName}` : ''}.`,
		'',
		`Tittel: ${title}`,
		description ? `Beskrivelse: ${description}` : null,
		`Starter: ${startsAt}`,
		`Bli med: ${roomUrl}`,
		'',
		'Denne invitasjonen administreres av edumeet. Godta eller avslå fra kalenderen din for å varsle arrangøren.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Møtet "${title}" er avlyst${organizerName ? ` av ${organizerName}` : ''}.`,
		'',
		'Kalenderen din oppdateres automatisk.'
	].join('\n')
};
