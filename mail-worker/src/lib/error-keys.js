import en from '../i18n/en.js';
import zh from '../i18n/zh.js';
const patterns = Object.entries({ en, zh }).flatMap(([, messages]) =>
	Object.entries(messages)
		.filter(([, text]) => typeof text === 'string')
		.map(([key, text]) => {
			const variables = [];
			const parts = text.split(/(\{\{\w+\}\})/g).map((part) => {
				if (/^\{\{\w+\}\}$/.test(part)) {
					variables.push(part.slice(2, -2));
					return '(.+?)';
				}
				return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			});
			return { key: `server_${key}`, pattern: new RegExp(`^${parts.join('')}$`), variables };
		})
);
export function errorMetadata(message) {
	if (/^(?:translateError\w+|invalidInput|serviceUnavailable)$/.test(message))
		return { errorKey: message };
	for (const entry of patterns) {
		const match = String(message).match(entry.pattern);
		if (match)
			return {
				errorKey: entry.key,
				errorParams: Object.fromEntries(
					entry.variables.map((key, index) => [key, match[index + 1]])
				)
			};
	}
	return {};
}
