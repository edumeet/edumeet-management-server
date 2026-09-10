import { InviteStrings } from './types';

export const cnStrings: InviteStrings = {
	subjectRequest: (title) => `会议邀请：${title}`,
	subjectCancel: (title) => `已取消：${title}`,
	invited: (organizerName) => `您被邀请参加一个会议${organizerName ? `（邀请人：${organizerName}）` : ''}。`,
	cancelled: (title, organizerName) => `会议"${title}"已被取消${organizerName ? `（取消人:${organizerName}）` : ''}。`,
	title: '主题：',
	description: '描述：',
	starts: '开始时间：',
	ends: '结束时间：',
	join: '加入：',
	joinButton: '加入会议',
	managedBy: '本邀请由 edumeet 管理。请在您的日历中接受或拒绝以通知组织者。',
	calendarUpdates: '您的日历将自动更新。'
};
