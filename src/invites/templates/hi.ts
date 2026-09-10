import { InviteStrings } from './types';

export const hiStrings: InviteStrings = {
	subjectRequest: (title) => `आमंत्रण: ${title}`,
	subjectCancel: (title) => `रद्द: ${title}`,
	invited: (organizerName) => `आपको एक बैठक में आमंत्रित किया गया है${organizerName ? `, ${organizerName} द्वारा` : ''}।`,
	cancelled: (title, organizerName) => `बैठक "${title}" रद्द कर दी गई है${organizerName ? `, ${organizerName} द्वारा` : ''}।`,
	title: 'शीर्षक: ',
	description: 'विवरण: ',
	starts: 'आरंभ: ',
	ends: 'समाप्ति: ',
	join: 'शामिल हों: ',
	joinButton: 'बैठक में शामिल हों',
	managedBy: 'यह आमंत्रण edumeet द्वारा प्रबंधित है। आयोजक को सूचित करने के लिए अपने कैलेंडर से स्वीकार या अस्वीकार करें।',
	calendarUpdates: 'आपका कैलेंडर स्वचालित रूप से अपडेट हो जाएगा।'
};
