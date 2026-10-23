import { languages } from '../../../shared/locale-utils.mjs';
import userContext from '../security/user-context';
import BizError from '../error/biz-error';
export default {
	async get(c) {
		const row = await c.env.db
			.prepare('SELECT locale FROM mail_user_locale WHERE user_id=?')
			.bind(userContext.getUserId(c))
			.first();
		return { locale: row?.locale || null };
	},
	async save(c, params) {
		if (!languages.some((language) => language.code === params?.locale))
			throw new BizError('invalidInput', 400);
		await c.env.db
			.prepare(
				'INSERT INTO mail_user_locale(user_id,locale) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET locale=excluded.locale'
			)
			.bind(userContext.getUserId(c), params.locale)
			.run();
		return this.get(c);
	}
};
