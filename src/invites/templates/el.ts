import { InviteStrings } from './types';

export const elStrings: InviteStrings = {
	subjectRequest: (title) => `Πρόσκληση: ${title}`,
	subjectCancel: (title) => `Ακυρώθηκε: ${title}`,
	invited: (organizerName) => `Έχετε προσκληθεί σε συνάντηση${organizerName ? ` από ${organizerName}` : ''}.`,
	cancelled: (title, organizerName) => `Η συνάντηση "${title}" ακυρώθηκε${organizerName ? ` από ${organizerName}` : ''}.`,
	title: 'Τίτλος: ',
	description: 'Περιγραφή: ',
	starts: 'Έναρξη: ',
	ends: 'Λήξη: ',
	join: 'Συμμετοχή: ',
	joinButton: 'Συμμετοχή στη συνάντηση',
	managedBy: 'Αυτή η πρόσκληση διαχειρίζεται από το edumeet. Αποδεχτείτε ή απορρίψτε από το ημερολόγιό σας για να ενημερώσετε τον διοργανωτή.',
	calendarUpdates: 'Το ημερολόγιό σας θα ενημερωθεί αυτόματα.'
};
