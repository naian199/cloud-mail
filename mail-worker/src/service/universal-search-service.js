import BizError from '../error/biz-error';
import mail from './mail-chat-service';
import chat from './chat-service';
import contacts from './contact-service';
import rooms from './room-service';
import { profilesFor } from './profile-service';
import { redactRemovedQuotes } from './removed-mail-service';
import { addresses, chatBody } from '../lib/mail-conversations';

const positive = value => {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new BizError('invalidInput', 400);
  return n;
};
const excerpt = (text, query) => { const at = text.toLocaleLowerCase().indexOf(query), start = Math.max(0, at-80); return (start?'…':'')+text.slice(start,start+400)+(text.length>start+400?'…':''); };
const includes = (value, query) => String(value || '').toLocaleLowerCase().includes(query);
export default {
  async search(c, query) {
    const account = await mail.account(c, query.accountId);
    const term = typeof query.search === 'string' ? query.search.trim() : '';
    const section = query.section || 'all';
    if (!term || term.length > 100 || !['all','mail','room','conversations'].includes(section)) throw new BizError('invalidInput',400);
    const lower = term.toLocaleLowerCase(), handle = lower.replace(/^@/,'');
    const beforeMail = positive(query.beforeMail), beforeRoom = positive(query.beforeRoom), beforeConversation = positive(query.beforeConversation);
    const data = { friends:[],users:[],rooms:[],conversations:[],messages:[],roomMessages:[] };
    if (section === 'all' || section === 'conversations') {
      const found = await mail.list(c, { accountId:account.account_id, search:term, identityOnly:true, ...(beforeConversation ? { before:beforeConversation } : {}) });
      data.conversations = found.conversations.map(({preview,...conversation})=>conversation);
      data.moreConversations = found.hasMore;
      data.indexing = found.indexing;
      data.beforeConversation = found.conversations.at(-1)?.latestId || null;
    }
    if (section === 'all') {
      const [friends, memberships, directory] = await Promise.all([
        chat.list(c), rooms.list(c), /^[a-z][a-z0-9_]{2,23}$/.test(handle) ? contacts.search(c,{username:handle}) : []
      ]);
      data.friends = friends.filter(person => [person.email,person.remark,person.displayName,person.username].some(value=>includes(value,lower)) || includes(person.username,handle)).slice(0,20);
      const known = new Set(friends.map(person=>person.username).filter(Boolean));
      data.users = directory.filter(person=>!known.has(person.username));
      data.rooms = memberships.filter(room=>includes(room.name,lower)).slice(0,20);
    }
    if (section === 'all' || section === 'mail') {
      // Search only this actor's active mailbox and visible messages. References are
      // redacted and rechecked before returning snippets, never returned as raw HTML.
      const { results } = await c.env.db.prepare(`SELECT e.email_id AS emailId,e.conversation_key AS key,e.conversation_peers AS peers,
        e.send_email AS sendEmail,e.subject,e.text,e.content,e.create_time AS createTime,
        (SELECT group_concat(a.filename,' · ') FROM attachments a WHERE a.email_id=e.email_id AND a.user_id=e.user_id AND a.account_id=e.account_id AND a.type IN (0,1)) AS files
        FROM email e WHERE e.user_id=? AND e.account_id=? AND e.is_del=0 AND e.type IN (0,1) AND e.status!=6 AND e.conversation_key!=''
        AND (coalesce(e.message_id,'')='' OR NOT EXISTS(SELECT 1 FROM email prior WHERE prior.user_id=e.user_id AND prior.account_id=e.account_id AND prior.type=e.type AND prior.message_id=e.message_id AND prior.is_del=0 AND prior.status!=6 AND prior.email_id<e.email_id))
        ${beforeMail ? 'AND e.email_id<?' : ''}
        AND (instr(lower(coalesce(nullif(e.text,''),e.content,'')),?)>0 OR instr(lower(coalesce(e.subject,'')),?)>0
          OR EXISTS(SELECT 1 FROM attachments a WHERE a.email_id=e.email_id AND a.user_id=e.user_id AND a.account_id=e.account_id AND a.type IN (0,1) AND instr(lower(coalesce(a.filename,'')),?)>0))
        ORDER BY e.email_id DESC LIMIT 51`).bind(account.user_id,account.account_id,...(beforeMail?[beforeMail]:[]),lower,lower,lower).all();
      const scanned = results.slice(0,50);
      await redactRemovedQuotes(c,scanned);
      const profiles = await profilesFor(c,scanned.flatMap(row=>addresses(row.peers)));
      const visible = [];
      for (const row of scanned) {
        const text = chatBody(row.text,row.content||'').replyText || '';
        if (![text,row.subject,row.files].some(value=>includes(value,lower))) continue;
        const peers = addresses(row.peers);
        visible.push({emailId:row.emailId,key:row.key,peers,sendEmail:row.sendEmail,subject:row.subject,
          createTime:row.createTime,text:excerpt(text,lower),files:String(row.files||'').slice(0,600),
          category:peers.length && peers.every(peer=>!!profiles.get(peer)?.email)?'internal':'external',
          profile:peers.length===1?profiles.get(peers[0]):null});
        if (visible.length===21) break;
      }
      data.messages = visible.slice(0,20);
      data.moreMail = visible.length>20 || results.length>50;
      data.beforeMail = visible.length>20 ? visible[19].emailId : scanned.at(-1)?.emailId || null;
    }
    if (section === 'all' || section === 'room') {
      const { results } = await c.env.db.prepare(`SELECT msg.id,msg.room_id AS roomId,r.name,r.kind,msg.body AS text,msg.created_at AS createdAt
        FROM mail_room_message msg JOIN mail_room r ON r.id=msg.room_id
        JOIN mail_room_member member ON member.room_id=r.id AND member.user_id=? AND member.status='joined'
        JOIN user actor ON actor.user_id=member.user_id AND actor.status=0 AND actor.is_del=0
        JOIN user owner ON owner.user_id=r.owner_id AND owner.status=0 AND owner.is_del=0
        WHERE instr(lower(msg.body),?)>0 ${beforeRoom?'AND msg.id<?':''} ORDER BY msg.id DESC LIMIT 21`)
        .bind(account.user_id,lower,...(beforeRoom?[beforeRoom]:[])).all();
      data.roomMessages = results.slice(0,20).map(row=>({...row,text:excerpt(row.text,lower)}));
      data.moreRoom = results.length>20;
      data.beforeRoom = data.roomMessages.at(-1)?.id || null;
    }
    return data;
  }
};
