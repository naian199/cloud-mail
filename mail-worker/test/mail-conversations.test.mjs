import test from 'node:test';
import assert from 'node:assert/strict';
import {
	conversation,
	safeMailHtml,
	plainMail,
	threadReferences,
	chatBody,
	replyText,
	displayMail,
	externalMailPresentation
} from '../src/lib/mail-conversations.js';
import { migrateMailChat, ensureMailChat } from '../src/init/mail-chat-schema.js';
import { DatabaseSync } from 'node:sqlite';

test('mail conversations preserve identity across directions, subjects and participant order', async () => {
	const mailbox = { email: 'me@example.com' };
	const received = {
		sendEmail: 'Friend@Example.COM',
		toEmail: 'me+tag@example.com',
		recipient: JSON.stringify([{ address: 'me+tag@example.com' }]),
		subject: 'One'
	};
	const sent = {
		sendEmail: 'me@example.com',
		recipient: '["friend@example.com"]',
		subject: 'Another'
	};
	assert.equal(
		(await conversation(received, mailbox)).key,
		(await conversation(sent, mailbox)).key
	);
	const group = { ...received, cc: '[{"address":"third@example.com"}]' };
	assert.notEqual(
		(await conversation(group, mailbox)).key,
		(await conversation(received, mailbox)).key
	);
	assert.deepEqual(
		(await conversation({ ...sent, bcc: '["hidden@example.com"]' }, mailbox)).peers,
		['friend@example.com']
	);
});

test('rich mail preview removes active content and external resource requests', () => {
	const input =
		'<p onclick="alert(1)">Hello<br>World</p><script>alert(1)</script><img src="https://tracker.invalid/pixel"><iframe src="https://tracker.invalid"></iframe><a href="javascript:alert(1)">link</a><meta http-equiv="refresh" content="0;url=https://tracker.invalid"><svg><script>alert(1)</script></svg>';
	const safe = safeMailHtml(input);
	assert(!/script|onclick|https:|javascript:|iframe|http-equiv|svg/i.test(safe));
	assert.match(safe, /Hello/);
	assert.match(plainMail(input), /Hello\nWorld/);
	assert(!plainMail(input).includes('alert(1)'));
	assert.equal(
		threadReferences({ relation: '<a@host> <b@host>', messageId: '<b@host>' }),
		'<a@host> <b@host>'
	);
	const link = safeMailHtml('<a href="https://example.com/verify" onclick="alert(1)">Verify</a>');
	assert.match(link, /href="https:\/\/example.com\/verify"/);
	assert.match(link, /noopener noreferrer/);
	assert.match(
		plainMail('<a href="https://example.com/verify">Verify</a>'),
		/https:\/\/example.com\/verify/
	);
});

test('schema gate handles concurrent first requests, preserves mail, and caches readiness', async () => {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec(
		"PRAGMA foreign_keys=ON;CREATE TABLE user(user_id INTEGER PRIMARY KEY);CREATE TABLE account(account_id INTEGER PRIMARY KEY);CREATE TABLE email(email_id INTEGER PRIMARY KEY,user_id INTEGER,account_id INTEGER,subject TEXT,type INTEGER,message_id TEXT);INSERT INTO email VALUES(1,1,1,'original',0,'<old@test>');"
	);
	let queries = 0;
	// Existing deployments have the v2 marker and must still receive the new profile table.
	sqlite.exec('CREATE TABLE mail_chat_schema_v2(id INTEGER PRIMARY KEY)');
	const db = {
		prepare(sql) {
			queries++;
			let args = [];
			return {
				bind(...values) {
					args = values;
					return this;
				},
				async first() {
					return sqlite.prepare(sql).get(...args) || null;
				},
				async all() {
					return { results: sqlite.prepare(sql).all(...args) };
				},
				async run() {
					sqlite.prepare(sql).run(...args);
				}
			};
		},
		async batch(statements) {
			for (const s of statements) await s.run();
		}
	};
	try {
		await Promise.all([ensureMailChat({ db }), ensureMailChat({ db })]);
		assert(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='mail_user_profile'").get());
		const readyQueries = queries;
		await ensureMailChat({ db });
		assert.equal(queries, readyQueries);
		await migrateMailChat(db);
		assert.equal(sqlite.prepare('SELECT subject FROM email').get().subject, 'original');
		assert.equal(sqlite.prepare('SELECT conversation_key FROM email').get().conversation_key, '');
	} finally {
		sqlite.close();
	}
});

test('chat bubbles contain only the new reply, including inline Chinese nested history', () => {
	assert.equal(
		replyText('我爱你❤️ 10 月 17 日，星期六，下午4:02 188 <188@naian.edu.kg> 写道：嗨'),
		'我爱你❤️'
	);
	assert.equal(
		replyText(
			'😘😘 10月17日星期六下午4:04 199 <199@naian.edu.kg> 写道：我爱你❤️ 10月17日188写道：嗨'
		),
		'😘😘'
	);
	assert.equal(
		replyText('收到\nOn Sat, Oct 17, 2026 at 4:02 PM\nFriend <friend@example.com> wrote:\n> Hello'),
		'收到'
	);
	assert.equal(replyText('好的\n在2026年10月17日 188写道：你好'), '好的');
	assert.equal(
		replyText('讨论 10月17日的安排，不是引用\n第二行'),
		'讨论 10月17日的安排，不是引用\n第二行'
	);
	assert.equal(replyText('保留我的 > 比较符号和正文'), '保留我的 > 比较符号和正文');
	assert.equal(
		chatBody(
			'fallback',
			'<div>新回复</div><div class="gmail_quote">旧内容<img src="https://old.example/pic.png"></div>'
		).replyText,
		'新回复'
	);
	assert.deepEqual(
		chatBody(
			'',
			'<div>新回复</div><blockquote>旧内容<img src="https://old.example/pic.png"></blockquote>'
		).images,
		[]
	);
});

test('chat images resolve authenticated embedded pictures and raster attachments, rejecting unsafe URLs', () => {
	const atts = [
		{
			attId: 1,
			contentId: '<photo>',
			key: 'attachments/photo.png',
			type: 1,
			mimeType: 'image/png'
		},
		{ attId: 2, filename: 'picture.jpg', type: 0, mimeType: 'image/jpeg' },
		{ attId: 3, filename: 'script.svg', type: 0, mimeType: 'image/svg+xml' }
	];
	const body = chatBody(
		'',
		'<p>照片</p><img src="cid:photo"><img src="{{domain}}attachments/photo.png"><img src="https://example.com/p.png"><img src="javascript:alert(1)"><img src="data:text/html;base64,PHNjcmlwdD4="><img width="1" src="https://tracker.example/pixel">',
		atts
	);
	assert.equal(body.replyText, '照片');
	assert.deepEqual(body.images, [
		{ attId: 1, alt: '' },
		{ src: 'https://example.com/p.png', alt: '' },
		{ attId: 2, alt: 'picture.jpg' }
	]);
});

test('real-world inline reply headers without whitespace and English dates are hidden', () => {
	for (const value of [
		'我爱你❤️10 月 17 日，星期六，下午4:02 188 <188@naian.edu.kg> 写道：',
		'😘😘10月17日星期六下午4:04 199 <199@naian.edu.kg>写道：',
		'😘😘Sat, Oct 17, 4:04 PM 199 <199@naian.edu.kg> wrote:',
		'😘😘2026/10/17 16:04 199 <199@naian.edu.kg> 写道：'
	])
		assert.equal(replyText(value), value.startsWith('我') ? '我爱你❤️' : '😘😘');
	assert.equal(
		chatBody(
			'',
			'<div>😘😘<span>10月17日星期六下午4:04 199 &lt;199@naian.edu.kg&gt;写道：</span></div>'
		).replyText,
		'😘😘'
	);
});

test('Chinese 来信 history headers disappear even when joined directly to the reply', () => {
	const samples = [
		['你好2026年7月3日周五凌晨5:37 199<199@naian.edu.kg>来信:', '你好'],
		['小呆瓜 2026年7月3日 周五凌晨5:37 199 <199@naian.edu.kg> 来信:', '小呆瓜'],
		['2026年7月3日周五凌晨5:37 199<199@naian.edu.kg>来信:', ''],
		[
			'你看到我得消息了吗 2026年7月3日 周五凌晨5:37 199<199@naian.edu.kg>来信:',
			'你看到我得消息了吗'
		],
		[
			'忘记登录了🤣 2026年7月3日 周五 早上6:42 shier1688 <shier1688@naian.edu.kg> 来信:',
			'忘记登录了🤣'
		],
		[
			'忘记回你了 2026年7月3日 周五 早上6:42 shier1688 <shier1688@naian.edu.kg> 来信:',
			'忘记回你了'
		],
		['同样好玩 2026年7月5日 周日 晚上22:42 199 <199@naian.edu.kg> 来信:', '同样好玩'],
		['收到2026 年 7 月 10 日 周五 中午12:20 199 <199@naian.edu.kg> 來信：旧内容', '收到'],
		['收到7月10日 周五 中午12:20 199 <199@naian.edu.kg> 来信：旧内容', '收到'],
		['收到2026/7/10 12:20 199 <199@naian.edu.kg> 来信：旧内容', '收到']
	];
	for (const [input, expected] of samples) {
		assert.equal(replyText(input), expected);
		assert.equal(chatBody(input).replyText, expected);
	}
	assert.equal(
		chatBody(
			'',
			'<div>你好<span>2026年7月3日周五凌晨5:37 199&lt;199@naian.edu.kg&gt;来信:</span></div>'
		).replyText,
		'你好'
	);
	for (const input of [
		'2026年7月3日收到你的来信，很开心',
		'谢谢来信：内容已经看过',
		'下次约在2026年7月3日凌晨5:37见'
	]) {
		assert.equal(replyText(input), input);
	}
});

test('legacy image URLs resolve to private attachments even with generic MIME and URL-encoded CID', () => {
	const atts = [
		{
			attId: 10,
			key: 'attachments/photo.jpg',
			type: 0,
			filename: 'photo.jpg',
			mimeType: 'application/octet-stream'
		},
		{ attId: 11, contentId: '<photo@host>', key: 'attachments/inline.png', type: 1 }
	];
	for (const src of [
		'{{domain}}/attachments/photo.jpg',
		'attachments/photo.jpg',
		'https://old.example/attachments/photo.jpg'
	]) {
		assert.deepEqual(chatBody('', `<img src="${src}">`, atts).images, [{ attId: 10, alt: '' }]);
	}
	assert.equal(chatBody('', '<img src="cid:photo%40host">', atts).images[0].attId, 11);
	assert.doesNotThrow(() => chatBody('', '<img src="cid:bad%">', atts));
});

test('explicit quote is a separate card and never repeats inside the new reply text', () => {
	const body = chatBody(
		'',
		'<div>这是回复</div><blockquote class="cloud-mail-reference" data-message-id="&lt;one@host&gt;" data-author="friend@example.com">之前的内容</blockquote>'
	);
	assert.equal(body.replyText, '这是回复');
	assert.deepEqual(body.quote, {
		messageId: '<one@host>',
		author: 'friend@example.com',
		text: '之前的内容'
	});
});

test('external mail keeps layout, styles, real links and image sizes without active content', () => {
	const html =
		'<style>.note{color:#123456}</style><table width="600" style="max-width:100%"><tr><td><a href="https://example.com/task?tracking=long" onclick="alert(1)">SCRUM-1</a><img width="84" height="30" src="https://example.com/logo.png"><img src="cid:photo"></td></tr></table><script>alert(1)</script><iframe src="https://example.com"></iframe><img width="1" src="https://example.com/pixel">';
	const result = displayMail(html, [{ attId: 42, contentId: '<photo>', key: 'attachments/p.png' }]);
	assert.match(result.richHtml, /<table/);
	assert.match(result.richHtml, /width="84"/);
	assert.match(result.richHtml, /style="max-width:100%"/);
	assert.match(result.richHtml, /href="https:\/\/example.com\/task\?tracking=long"/);
	assert.match(result.richHtml, /src="https:\/\/example.com\/logo.png"/);
	assert.match(result.richHtml, /src="mail-image:42"/);
	assert(!/script|onclick|iframe|pixel/.test(result.richHtml));
	assert.deepEqual(result.richImages, [{ attId: 42, alt: '' }]);
	assert(!safeMailHtml('<img src="https://example.com/logo.png">').includes('https:'));
});


test('ordinary external HTML replies become compact bubbles with separately recoverable history', () => {
 const html = '<div dir="ltr">好的,我记住了<br><br></div><div class="gmail_quote"><div>On Monday, wrote:</div><blockquote><table><tr><td>我的学校邮箱</td></tr></table></blockquote></div>';
 const view = externalMailPresentation('好的,我记住了\n我的学校邮箱', html);
 assert.equal(view.compactMail, true);
 assert.equal(view.replyText, '好的,我记住了');
 assert.match(view.quotedText, /我的学校邮箱/);
 assert.match(displayMail(html).richHtml, /我的学校邮箱/);
 assert.equal(externalMailPresentation('短消息').replyText, '短消息');
});

test('brand tables, pictures and visual layouts preserve rich presentation', () => {
 for (const html of [
  '<table><tr><td>Atlassian news</td></tr></table>',
  '<p>News</p><img src="https://example.com/news.png">',
  '<div style="background:#123;padding:30px">Welcome</div>',
  '<ul><li>Structured content</li></ul>'
 ]) assert.equal(externalMailPresentation('Original text', html).compactMail, false, html);
});

test('plain text and Outlook histories collapse without losing quote-only messages', () => {
 const plain = externalMailPresentation('New reply\n> Earlier mail');
 assert.equal(plain.replyText, 'New reply');
 assert.match(plain.quotedText, /Earlier mail/);
 const outlook = externalMailPresentation('', '<div>New reply</div><div id="divRplyFwdMsg">From: Alice</div><p>Earlier mail</p>');
 assert.equal(outlook.replyText, 'New reply');
 assert.equal(outlook.quotedText, 'Earlier mail');
 assert.match(externalMailPresentation('> Earlier mail').replyText, /Earlier mail/);
});

test('full email documents and white space wrappers do not turn simple replies into large cards', () => {
 const html = '<html><head><meta charset="UTF-8"><style>body{color:black}</style></head><body><div style="width:100%;min-height:240px;padding:20px;background-color:white">好的,我记住了</div><blockquote style="border-left:1px solid gray">我的学校邮箱</blockquote></body></html>';
 const view = externalMailPresentation('好的,我记住了\n我的学校邮箱', html);
 assert.equal(view.compactMail, true);
 assert.equal(view.replyText, '好的,我记住了');
 assert.equal(view.quotedText, '我的学校邮箱');
});
