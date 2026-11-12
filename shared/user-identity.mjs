export const RESERVED_USERNAMES = new Set(['admin','administrator','root','system','official','support','help','security','postmaster','mailer_daemon','abuse','noreply','no_reply','webmaster','cloudmail']);
export function identityUsername(value) {
 const name=typeof value==='string'?value.trim().replace(/^@/,'').toLowerCase():'';
 if(!/^[a-z][a-z0-9_]{3,23}$/.test(name))return {name,error:'identityUsernameRules'};
 if(RESERVED_USERNAMES.has(name))return {name,error:'identityUsernameReserved'};
 return {name,error:null};
}
