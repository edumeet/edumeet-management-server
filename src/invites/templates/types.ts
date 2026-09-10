export interface InviteContext {
	title: string;
	description?: string;
	roomUrl: string;
	organizerName?: string;
	// startsAt and endsAt are pre-formatted human-readable strings (locale + timezone aware)
	// produced in sender.ts via Intl.DateTimeFormat. The ICS attachment carries the
	// machine-readable times — these fields are only for the email body.
	startsAt: string;
	endsAt: string;
}

// eslint-disable-next-line no-unused-vars
export type SubjectFn = (title: string) => string;
// eslint-disable-next-line no-unused-vars
export type BodyFn = (ctx: InviteContext) => string;

// One locale's wording. The label fields are the exact prefixes that precede a value in the
// plain-text body, punctuation and spacing included ("Title: ", "Titre : ", "主题："), so a
// locale keeps its own typography without the renderer knowing about it.
export interface InviteStrings {
	subjectRequest: SubjectFn;
	subjectCancel: SubjectFn;
	// eslint-disable-next-line no-unused-vars
	invited: (organizerName?: string) => string;
	// eslint-disable-next-line no-unused-vars
	cancelled: (title: string, organizerName?: string) => string;
	title: string;
	description: string;
	starts: string;
	ends: string;
	join: string;
	joinButton: string;
	managedBy: string;
	calendarUpdates: string;
}

export interface EventDescription {
	plain: string;
	html: string;
}

export interface InviteTemplate {
	subjectRequest: SubjectFn;
	subjectCancel: SubjectFn;
	bodyRequest: BodyFn;
	bodyCancel: BodyFn;
	htmlRequest: BodyFn;
	htmlCancel: BodyFn;
	// DESCRIPTION for the VEVENT, so the join link lives in the calendar entry itself
	// eslint-disable-next-line no-unused-vars
	eventDescription: (ctx: InviteContext) => EventDescription;
}
