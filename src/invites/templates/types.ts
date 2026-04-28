export interface InviteContext {
	title: string;
	description?: string;
	roomUrl: string;
	organizerName?: string;
	// startsAt and endsAt are pre-formatted human-readable strings (locale + timezone aware)
	// produced in sender.ts via Intl.DateTimeFormat. The ICS attachment carries the
	// machine-readable times — these fields are only for the plain-text email body.
	startsAt: string;
	endsAt: string;
}

// eslint-disable-next-line no-unused-vars
export type SubjectFn = (title: string) => string;
// eslint-disable-next-line no-unused-vars
export type BodyFn = (ctx: InviteContext) => string;

export interface InviteTemplate {
	subjectRequest: SubjectFn;
	subjectCancel: SubjectFn;
	bodyRequest: BodyFn;
	bodyCancel: BodyFn;
}
