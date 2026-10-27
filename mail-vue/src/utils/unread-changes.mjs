export const UNREAD_CHANGED='cloud-mail:unread-changed';
// Trigger reconciliation only after a successful read; never guess that all conversations are read.
export async function afterUnreadChange(request){
 const result=await request;
 window.dispatchEvent(new Event(UNREAD_CHANGED));
 try{localStorage.setItem(UNREAD_CHANGED,crypto.randomUUID());}catch{}
 return result;
}
