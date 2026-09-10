import { InviteStrings } from './types';

export const ukStrings: InviteStrings = {
	subjectRequest: (title) => `Запрошення: ${title}`,
	subjectCancel: (title) => `Скасовано: ${title}`,
	invited: (organizerName) => `Вас запрошено на зустріч${organizerName ? ` від ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Зустріч "${title}" скасовано${organizerName ? ` від ${organizerName}` : ''}.`,
	title: 'Назва: ',
	description: 'Опис: ',
	starts: 'Початок: ',
	ends: 'Завершення: ',
	join: 'Приєднатися: ',
	joinButton: 'Приєднатися до зустрічі',
	managedBy: 'Це запрошення керується edumeet. Прийміть або відхиліть у своєму календарі, щоб повідомити організатора.',
	calendarUpdates: 'Ваш календар буде оновлено автоматично.'
};
