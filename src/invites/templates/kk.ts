import { InviteTemplate } from './types';

export const kkTemplate: InviteTemplate = {
	subjectRequest: (title) => `Шақыру: ${title}`,
	subjectCancel: (title) => `Болдырылмады: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Сіз кездесуге шақырылдыңыз${organizerName ? `, ${organizerName} тарапынан` : ''}.`,
		'',
		`Атауы: ${title}`,
		description ? `Сипаттамасы: ${description}` : null,
		`Басталуы: ${startsAt}`,
		`Қосылу: ${roomUrl}`,
		'',
		'Бұл шақыруды edumeet басқарады. Ұйымдастырушыны хабардар ету үшін күнтізбеңізден қабылдаңыз немесе қабылдамаңыз.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`"${title}" кездесуі болдырылмады${organizerName ? `, ${organizerName} тарапынан` : ''}.`,
		'',
		'Күнтізбеңіз автоматты түрде жаңартылады.'
	].join('\n')
};
