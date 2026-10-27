import {mailDate} from './mail-chat-display.js';
export function sortConversations(rows, order = []) {
  const rank = new Map(order.map((key,index)=>[key,index]));
  return [...rows].sort((a,b)=>Number(b.pinned)-Number(a.pinned) ||
    (rank.get(a.key) ?? -1)-(rank.get(b.key) ?? -1) ||
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
