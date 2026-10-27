import push from '../service/push-service';
import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import profile from '../service/profile-service';
import locale from '../service/locale-service';
import contacts from '../service/contact-service';
app.put('/my/username', async c => c.json(result.ok(await contacts.username(c, await c.req.json()))));
app.get('/my/locale', async (c) => c.json(result.ok(await locale.get(c))));
app.put('/my/locale', async (c) => c.json(result.ok(await locale.save(c, await c.req.json()))));

app.get('/my/profile', async (c) => c.json(result.ok(await profile.get(c))));
app.put('/my/profile', async (c) => c.json(result.ok(await profile.save(c, await c.req.json()))));
app.get('/my/notifications', async (c) => c.json(result.ok(await profile.alerts(c, c.req.query()))));

app.get('/my/loginUserInfo', async (c) => {
	const user = await userService.loginUserInfo(c, userContext.getUserId(c));
	return c.json(result.ok(user));
});

app.put('/my/resetPassword', async (c) => {
	await userService.resetPassword(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.delete('/my/delete', async (c) => {
	await userService.delete(c, userContext.getUserId(c));
	return c.json(result.ok());
});



app.get('/my/push/config',async c=>c.json(result.ok(await push.config(c))));
app.put('/my/push/preferences',async c=>c.json(result.ok(await push.save(c,await c.req.json()))));
app.put('/my/push/mute',async c=>c.json(result.ok(await push.mute(c,await c.req.json()))));
app.post('/my/push/subscription',async c=>c.json(result.ok(await push.subscribe(c,await c.req.json()))));
app.delete('/my/push/subscription',async c=>{await push.unsubscribe(c,await c.req.json());return c.json(result.ok());});
app.get('/my/push/poll',async c=>c.json(result.ok(await push.poll(c,c.req.query()))));
