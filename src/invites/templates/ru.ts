import { InviteStrings } from './types';

export const ruStrings: InviteStrings = {
	subjectRequest: (title) => `Приглашение: ${title}`,
	subjectCancel: (title) => `Отменено: ${title}`,
	invited: (organizerName) => `Вас пригласили на встречу${organizerName ? ` от ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Встреча "${title}" отменена${organizerName ? ` от ${organizerName}` : ''}.`,
	title: 'Название: ',
	description: 'Описание: ',
	starts: 'Начало: ',
	ends: 'Окончание: ',
	join: 'Присоединиться: ',
	joinButton: 'Присоединиться к встрече',
	managedBy: 'Это приглашение управляется edumeet. Примите или отклоните в своём календаре, чтобы уведомить организатора.',
	calendarUpdates: 'Ваш календарь будет обновлён автоматически.'
};
