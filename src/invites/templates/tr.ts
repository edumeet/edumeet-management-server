import { InviteStrings } from './types';

export const trStrings: InviteStrings = {
	subjectRequest: (title) => `Davet: ${title}`,
	subjectCancel: (title) => `İptal edildi: ${title}`,
	invited: (organizerName) => `Bir toplantıya davet edildiniz${organizerName ? `; davet eden: ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `"${title}" toplantısı iptal edildi${organizerName ? `; iptal eden: ${organizerName}` : ''}.`,
	title: 'Başlık: ',
	description: 'Açıklama: ',
	starts: 'Başlangıç: ',
	ends: 'Bitiş: ',
	join: 'Katıl: ',
	joinButton: 'Toplantıya katıl',
	managedBy: 'Bu davetiye edumeet tarafından yönetilmektedir. Düzenleyiciyi bilgilendirmek için takviminizden kabul edin veya reddedin.',
	calendarUpdates: 'Takviminiz otomatik olarak güncellenecektir.'
};
