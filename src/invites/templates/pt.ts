import { InviteStrings } from './types';

export const ptStrings: InviteStrings = {
	subjectRequest: (title) => `Convite: ${title}`,
	subjectCancel: (title) => `Cancelado: ${title}`,
	invited: (organizerName) => `Foi convidado para uma reunião${organizerName ? ` por ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `A reunião "${title}" foi cancelada${organizerName ? ` por ${organizerName}` : ''}.`,
	title: 'Título: ',
	description: 'Descrição: ',
	starts: 'Início: ',
	ends: 'Fim: ',
	join: 'Participar: ',
	joinButton: 'Participar na reunião',
	managedBy: 'Este convite é gerido pelo edumeet. Aceite ou recuse no seu calendário para informar o organizador.',
	calendarUpdates: 'O seu calendário será atualizado automaticamente.'
};
