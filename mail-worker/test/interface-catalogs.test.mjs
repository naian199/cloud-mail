import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createI18n } from '../../mail-vue/node_modules/vue-i18n/dist/vue-i18n.node.mjs';
import { languages } from '../../shared/locale-utils.mjs';

test('all added interface catalogs compile without broken message syntax', (t) => {
	const failures = [];
	t.mock.method(console, 'error', (...args) => failures.push(args.join(' ')));
	for (const language of languages.filter((item) => !['en', 'zh'].includes(item.code))) {
		const messages = JSON.parse(
			fs.readFileSync(
				new URL(`../../mail-vue/src/i18n/locales/${language.code}.json`, import.meta.url)
			)
		);
		const i18n = createI18n({
			legacy: false,
			locale: 'test',
			warnHtmlMessage: false,
			messages: { test: messages }
		});
		for (const key of Object.keys(messages))
			i18n.global.t(key, {
				count: 2,
				total: 2,
				msg: 'Example',
				name: 'Name',
				days: 3,
				email: 'mail@example.com'
			});
	}
	assert.deepEqual(failures, []);
});
