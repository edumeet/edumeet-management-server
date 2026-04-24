import { InviteTemplate } from './types';

export const hiTemplate: InviteTemplate = {
	subjectRequest: (title) => `आमंत्रण: ${title}`,
	subjectCancel: (title) => `रद्द: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`आपको एक बैठक में आमंत्रित किया गया है${organizerName ? `, ${organizerName} द्वारा` : ''}।`,
		'',
		`शीर्षक: ${title}`,
		description ? `विवरण: ${description}` : null,
		`आरंभ: ${startsAt}`,
		`शामिल हों: ${roomUrl}`,
		'',
		'यह आमंत्रण edumeet द्वारा प्रबंधित है। आयोजक को सूचित करने के लिए अपने कैलेंडर से स्वीकार या अस्वीकार करें।'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`बैठक "${title}" रद्द कर दी गई है${organizerName ? `, ${organizerName} द्वारा` : ''}।`,
		'',
		'आपका कैलेंडर स्वचालित रूप से अपडेट हो जाएगा।'
	].join('\n')
};
