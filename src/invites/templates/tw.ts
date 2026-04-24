import { InviteTemplate } from './types';

export const twTemplate: InviteTemplate = {
	subjectRequest: (title) => `會議邀請：${title}`,
	subjectCancel: (title) => `已取消：${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`您被邀請參加一個會議${organizerName ? `（邀請人：${organizerName}）` : ''}。`,
		'',
		`主題：${title}`,
		description ? `描述：${description}` : null,
		`開始時間：${startsAt}`,
		`加入：${roomUrl}`,
		'',
		'本邀請由 edumeet 管理。請在您的日曆中接受或拒絕以通知組織者。'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`會議「${title}」已被取消${organizerName ? `（取消人：${organizerName}）` : ''}。`,
		'',
		'您的日曆將自動更新。'
	].join('\n')
};
