import { InviteTemplate } from './types';

export const ruTemplate: InviteTemplate = {
	subjectRequest: (title) => `Приглашение: ${title}`,
	subjectCancel: (title) => `Отменено: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Вас пригласили на встречу${organizerName ? ` от ${organizerName}` : ''}.`,
		'',
		`Название: ${title}`,
		description ? `Описание: ${description}` : null,
		`Начало: ${startsAt}`,
		`Присоединиться: ${roomUrl}`,
		'',
		'Это приглашение управляется edumeet. Примите или отклоните в своём календаре, чтобы уведомить организатора.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Встреча "${title}" отменена${organizerName ? ` от ${organizerName}` : ''}.`,
		'',
		'Ваш календарь будет обновлён автоматически.'
	].join('\n')
};
