export async function notifyMail(env, ...users) {
	if (!env.CHAT_NOTIFICATIONS) return;
	await Promise.all(
		[...new Set(users.filter((id) => id > 0))].map(async (id) => {
			try {
				const stub = env.CHAT_NOTIFICATIONS.get(env.CHAT_NOTIFICATIONS.idFromName(String(id)));
				await stub.fetch('https://chat.internal/notify', { method: 'POST' });
			} catch {
				console.error('Mail notification unavailable; clients will reconcile');
			}
		})
	);
}
