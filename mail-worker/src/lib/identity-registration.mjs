export function identityRegistrationStatements(db,{email,username,nickname,password,salt,type,regKeyId}) {
 return [
 db.prepare('INSERT INTO user(email,reg_key_id,password,salt,type) VALUES(?,?,?,?,?)').bind(email,regKeyId,password,salt,type),
 db.prepare('INSERT INTO mail_user_handle(user_id,username) SELECT user_id,? FROM user WHERE email=? COLLATE NOCASE ORDER BY user_id DESC LIMIT 1').bind(username,email),
 db.prepare('INSERT INTO account(user_id,email,name) SELECT user_id,?,? FROM mail_user_handle WHERE username=?').bind(email,username,username),
 db.prepare('INSERT INTO mail_user_profile(user_id,display_name) SELECT user_id,? FROM mail_user_handle WHERE username=?').bind(nickname||username,username)
 ];
}
