import { InviteTemplate } from './types';

export const ukTemplate: InviteTemplate = {
	subjectRequest: (title) => `Запрошення: ${title}`,
	subjectCancel: (title) => `Скасовано: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Вас запрошено на зустріч${organizerName ? ` від ${organizerName}` : ''}.`,
		'',
		`Назва: ${title}`,
		description ? `Опис: ${description}` : null,
		`Початок: ${startsAt}`,
		`Приєднатися: ${roomUrl}`,
		'',
		'Це запрошення керується edumeet. Прийміть або відхиліть у своєму календарі, щоб повідомити організатора.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Зустріч "${title}" скасовано${organizerName ? ` від ${organizerName}` : ''}.`,
		'',
		'Ваш календар буде оновлено автоматично.'
	].join('\n')
};
