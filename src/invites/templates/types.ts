export interface InviteContext {
	title: string;
	description?: string;
	roomUrl: string;
	organizerName?: string;
	startsAt: string;
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
