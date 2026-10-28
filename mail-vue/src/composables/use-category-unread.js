import {ref} from 'vue';

const empty=()=>({categories:{chat:0,external:0,group:0,channel:0},accounts:{}});
export const categoryUnread=ref(empty());
export function setCategoryUnread(summary){categoryUnread.value=summary?.categories&&summary?.accounts?summary:empty();}
