import setting from './setting-service';
import BizError from '../error/biz-error';
import { packName, fetchPack, fetchSticker } from '../lib/telegram-stickers.mjs';
const fail = () => {
	throw new BizError(
		'Sticker unavailable / 表情包暂不可用，请检查链接或平台 Telegram 机器人配置',
		503
	);
};
export default {
	async pack(c, value) {
		let name;
		try {
			name = packName(value);
		} catch {
			throw new BizError('Invalid sticker pack / 表情包链接无效', 400);
		}
		const key = `stickers:pack:${name.toLowerCase()}`;
		const cached = await c.env.kv.get(key, { type: 'json' });
		if (cached) return cached;
		try {
			const { tgBotToken } = await setting.query(c);
			const pack = await fetchPack(tgBotToken, name);
			await c.env.kv.put(key, JSON.stringify(pack), { expirationTtl: 86400 });
			return pack;
		} catch {
			fail();
		}
	},
	async file(c, name, id) {
		const pack = await this.pack(c, name);
		const sticker = pack.stickers.find((s) => s.id === id);
		if (!sticker) throw new BizError('Sticker not found', 404);
		try {
			const { tgBotToken } = await setting.query(c);
			const bytes = await fetchSticker(tgBotToken, id);
			return new Response(bytes, {
				headers: {
					'Content-Type':
						sticker.format === 'webp'
							? 'image/webp'
							: sticker.format === 'webm'
								? 'video/webm'
								: 'application/x-tgsticker',
					'Cache-Control': 'private, no-store'
				}
			});
		} catch {
			fail();
		}
	}
};
