import test from 'node:test';
import assert from 'node:assert/strict';
import {
	showChatTime,
	chatTimeLabel,
	mailDate,
	conversationSubject
} from '../../mail-vue/src/utils/mail-chat-display.js';

test('chat time is shown for the first message, five minute gaps, and day changes', () => {
	assert(showChatTime('2026-10-17 09:32:00'));
	assert(!showChatTime('2026-10-17 09:35:00', '2026-10-17 09:32:00'));
	assert(showChatTime('2026-10-17 09:37:00', '2026-10-17 09:32:00'));
	const a = new Date(2026, 9, 18, 0, 1).toISOString(),
		b = new Date(2026, 9, 17, 23, 59).toISOString();
	assert(showChatTime(a, b));
	assert.equal(mailDate('2026-10-17 09:32:00').toISOString(), '2026-10-17T09:32:00.000Z');
});

test('chat time labels combine date and time without a label under each bubble', () => {
	const now = new Date(2026, 9, 22, 15);
	assert.equal(chatTimeLabel(new Date(2026, 9, 22, 14, 3).toISOString(), 'zh-CN', now), '14:03');
	assert.equal(
		chatTimeLabel(new Date(2026, 9, 21, 14, 3).toISOString(), 'zh-CN', now),
		'昨天 14:03'
	);
	assert.match(
		chatTimeLabel(new Date(2026, 9, 17, 14, 3).toISOString(), 'zh-CN', now),
		/10月17日 14:03/
	);
});

test('conversation heading uses our outgoing subject without repeated reply prefixes', () => {
 assert.equal(conversationSubject({ourSubject:'Re: Re: 学校邮箱', subject:'客户的主题'}), '学校邮箱');
 assert.equal(conversationSubject({subject:'Re: 客户来信'}), '客户来信');
 assert.equal(conversationSubject({ourSubject:'发布通知'}), '发布通知');
});
