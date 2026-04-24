import { InviteTemplate } from './types';

export const cnTemplate: InviteTemplate = {
	subjectRequest: (title) => `会议邀请：${title}`,
	subjectCancel: (title) => `已取消：${title}`,
	bodyRequest: ({ title, description, roomUrl, organizerName, startsAt }) => [
		`您被邀请参加一个会议${organizerName ? `（邀请人：${organizerName}）` : ''}。`,
		'',
		`主题：${title}`,
		description ? `描述：${description}` : null,
		`开始时间：${startsAt}`,
		`加入：${roomUrl}`,
		'',
		'本邀请由 edumeet 管理。请在您的日历中接受或拒绝以通知组织者。'
	].filter(Boolean).join('\n'),
	bodyCancel: ({ title, organizerName }) => [
		`会议"${title}"已被取消${organizerName ? `（取消人:${organizerName}）` : ''}。`,
		'',
		'您的日历将自动更新。'
	].join('\n')
};
