import { InviteTemplate } from './types';

export const esTemplate: InviteTemplate = {
	subjectRequest: (title) => `Invitación: ${title}`,
	subjectCancel: (title) => `Cancelado: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Has sido invitado a una reunión${organizerName ? ` por ${organizerName}` : ''}.`,
		'',
		`Título: ${title}`,
		description ? `Descripción: ${description}` : null,
		`Inicio: ${startsAt}`,
		`Unirse: ${roomUrl}`,
		'',
		'Esta invitación se gestiona mediante edumeet. Acepta o rechaza desde tu calendario para informar al organizador.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`La reunión "${title}" ha sido cancelada${organizerName ? ` por ${organizerName}` : ''}.`,
		'',
		'Tu calendario se actualizará automáticamente.'
	].join('\n')
};
