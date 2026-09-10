import { InviteStrings } from './types';

export const kkStrings: InviteStrings = {
	subjectRequest: (title) => `Шақыру: ${title}`,
	subjectCancel: (title) => `Болдырылмады: ${title}`,
	invited: (organizerName) => `Сіз кездесуге шақырылдыңыз${organizerName ? `, ${organizerName} тарапынан` : ''}.`,
	cancelled: (title, organizerName) => `"${title}" кездесуі болдырылмады${organizerName ? `, ${organizerName} тарапынан` : ''}.`,
	title: 'Атауы: ',
	description: 'Сипаттамасы: ',
	starts: 'Басталуы: ',
	ends: 'Аяқталуы: ',
	join: 'Қосылу: ',
	joinButton: 'Кездесуге қосылу',
	managedBy: 'Бұл шақыруды edumeet басқарады. Ұйымдастырушыны хабардар ету үшін күнтізбеңізден қабылдаңыз немесе қабылдамаңыз.',
	calendarUpdates: 'Күнтізбеңіз автоматты түрде жаңартылады.'
};
