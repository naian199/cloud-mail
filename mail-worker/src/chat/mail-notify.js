export async function notifyMail(env, ...users) {
	if (!env.CHAT_NOTIFICATIONS) return;
	await Promise.all(
		[...new Set(users.filter((id) => id > 0))].map(async (id) => {
			try {
				const stub = env.CHAT_NOTIFICATIONS.get(env.CHAT_NOTIFICATIONS.idFromName(String(id)));
				await stub.fetch('https://chat.internal/notify', { method: 'POST',headers:{'X-Notification-User':String(id)} });
			} catch {
				console.error('Mail notification unavailable; clients will reconcile');
			}
		})
	);
}

export async function notifyRoomUsers(env, roomId, users) {
	if (!env.CHAT_NOTIFICATIONS) return;
	try {
		const target=env.CHAT_NOTIFICATIONS.get(env.CHAT_NOTIFICATIONS.idFromName('room-notify:'+roomId));
		await target.fetch('https://chat.internal/rooms/notify', {
			method:'POST', headers:{'Content-Type':'application/json'},
			body:JSON.stringify({users:[...new Set(users.filter(id=>Number.isSafeInteger(id)&&id>0))]})
		});
	} catch { console.error('Room notification unavailable; clients will reconcile'); }
}
