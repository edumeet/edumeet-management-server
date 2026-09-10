import { InviteStrings } from './types';

export const twStrings: InviteStrings = {
	subjectRequest: (title) => `會議邀請：${title}`,
	subjectCancel: (title) => `已取消：${title}`,
	invited: (organizerName) => `您被邀請參加一個會議${organizerName ? `（邀請人：${organizerName}）` : ''}。`,
	cancelled: (title, organizerName) => `會議「${title}」已被取消${organizerName ? `（取消人：${organizerName}）` : ''}。`,
	title: '主題：',
	description: '描述：',
	starts: '開始時間：',
	ends: '結束時間：',
	join: '加入：',
	joinButton: '加入會議',
	managedBy: '本邀請由 edumeet 管理。請在您的日曆中接受或拒絕以通知組織者。',
	calendarUpdates: '您的日曆將自動更新。'
};
