import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedLinks, sharedImages } from '../src/lib/mail-shared-links.js';
test('shared links keep labeled mail links and reject active or credential URLs', () => {
	assert.deepEqual(
		sharedLinks(
			'Visit https://example.com/path. https://example.com/path',
			'<a href="https://example.net/?a=1&amp;b=2">Task</a><a href="javascript:alert(1)">Bad</a><a href="data:text/html,hi">Bad</a><a href="https://private:secret@example.org/">Secret</a><a href="/relative">Relative</a>'
		),
		['https://example.com/path', 'https://example.net/?a=1&b=2']
	);
	assert.equal(
		sharedLinks(Array.from({ length: 200 }, (_, i) => `https://example.com/${i}`).join(' ')).length,
		100
	);
});

test('mail gallery keeps remote pictures while private images remain authenticated', () => {
	assert.deepEqual(
		sharedImages(
			'<img src="https://example.org/photo.png" alt="Photo"><img src="mail-image:42"><img src="javascript:alert(1)"><img src="https://private:secret@example.org/photo"><img src="https://example.org/photo.png" alt="Photo">'
		),
		[{ src: 'https://example.org/photo.png', alt: 'Photo' }]
	);
});
