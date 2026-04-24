import { InviteTemplate } from './types';

export const elTemplate: InviteTemplate = {
	subjectRequest: (title) => `Πρόσκληση: ${title}`,
	subjectCancel: (title) => `Ακυρώθηκε: ${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`Έχετε προσκληθεί σε συνάντηση${organizerName ? ` από ${organizerName}` : ''}.`,
		'',
		`Τίτλος: ${title}`,
		description ? `Περιγραφή: ${description}` : null,
		`Έναρξη: ${startsAt}`,
		`Συμμετοχή: ${roomUrl}`,
		'',
		'Αυτή η πρόσκληση διαχειρίζεται από το edumeet. Αποδεχτείτε ή απορρίψτε από το ημερολόγιό σας για να ενημερώσετε τον διοργανωτή.'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`Η συνάντηση "${title}" ακυρώθηκε${organizerName ? ` από ${organizerName}` : ''}.`,
		'',
		'Το ημερολόγιό σας θα ενημερωθεί αυτόματα.'
	].join('\n')
};
