import { InviteTemplate } from './types';

export const trTemplate: InviteTemplate = {
	subjectRequest: (title) => `Davet: ${title}`,
	subjectCancel: (title) => `İptal edildi: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Bir toplantıya davet edildiniz${organizerName ? `; davet eden: ${organizerName}` : ''}.`,
		'',
		`Başlık: ${title}`,
		description ? `Açıklama: ${description}` : null,
		`Başlangıç: ${startsAt}`,
		`Katıl: ${roomUrl}`,
		'',
		'Bu davetiye edumeet tarafından yönetilmektedir. Düzenleyiciyi bilgilendirmek için takviminizden kabul edin veya reddedin.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`"${title}" toplantısı iptal edildi${organizerName ? `; iptal eden: ${organizerName}` : ''}.`,
		'',
		'Takviminiz otomatik olarak güncellenecektir.'
	].join('\n')
};
