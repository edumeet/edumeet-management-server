import { InviteStrings } from './types';

export const esStrings: InviteStrings = {
	subjectRequest: (title) => `Invitación: ${title}`,
	subjectCancel: (title) => `Cancelado: ${title}`,
	invited: (organizerName) => `Has sido invitado a una reunión${organizerName ? ` por ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `La reunión "${title}" ha sido cancelada${organizerName ? ` por ${organizerName}` : ''}.`,
	title: 'Título: ',
	description: 'Descripción: ',
	starts: 'Inicio: ',
	ends: 'Fin: ',
	join: 'Unirse: ',
	joinButton: 'Unirse a la reunión',
	managedBy: 'Esta invitación se gestiona mediante edumeet. Acepta o rechaza desde tu calendario para informar al organizador.',
	calendarUpdates: 'Tu calendario se actualizará automáticamente.'
};
