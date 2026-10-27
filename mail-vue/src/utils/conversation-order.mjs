import {mailDate} from './mail-chat-display.js';
export function sortConversations(rows, order = []) {
  const rank = new Map(order.map((key,index)=>[key,index]));
  const timestamp=row=>Number.isFinite(+mailDate(row.createTime)) ? +mailDate(row.createTime) : 0;
  const newestKnown=Math.max(-Infinity,...rows.filter(row=>rank.has(row.key)).map(timestamp));
  const position=row=>rank.get(row.key) ?? (timestamp(row)>newestKnown ? -1 : Number.MAX_SAFE_INTEGER);
  return [...rows].sort((a,b)=>Number(b.pinned)-Number(a.pinned) ||
    position(a)-position(b) ||
    (b.createTime ? +mailDate(b.createTime) : 0)-(a.createTime ? +mailDate(a.createTime) : 0) ||
    Number(b.latestId||0)-Number(a.latestId||0) || a.key.localeCompare(b.key));
}
export function moveConversation(rows, sourceKey, targetKey, after = false) {
  const source=rows.find(row=>row.key===sourceKey),target=rows.find(row=>row.key===targetKey);
  if(!source||!target||sourceKey===targetKey||!!source.pinned!==!!target.pinned)return null;
  const keys=rows.map(row=>row.key).filter(key=>key!==sourceKey);
  keys.splice(keys.indexOf(targetKey)+(after?1:0),0,sourceKey);
  return keys;
}
