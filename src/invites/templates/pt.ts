import { InviteTemplate } from './types';

export const ptTemplate: InviteTemplate = {
	subjectRequest: (title) => `Convite: ${title}`,
	subjectCancel: (title) => `Cancelado: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Foi convidado para uma reunião${organizerName ? ` por ${organizerName}` : ''}.`,
		'',
		`Título: ${title}`,
		description ? `Descrição: ${description}` : null,
		`Início: ${startsAt}`,
		`Participar: ${roomUrl}`,
		'',
		'Este convite é gerido pelo edumeet. Aceite ou recuse no seu calendário para informar o organizador.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`A reunião "${title}" foi cancelada${organizerName ? ` por ${organizerName}` : ''}.`,
		'',
		'O seu calendário será atualizado automaticamente.'
	].join('\n')
};
