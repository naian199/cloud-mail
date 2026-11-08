import { computed } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useUiStore } from '@/store/ui';
export function useConversationSidebar() {
  const ui=useUiStore();
  const compact=useMediaQuery('(max-width:767px), (max-width:1024px) and (max-height:500px) and (pointer:coarse)');
  const collapsed=computed(()=>ui.conversationCollapsed===true&&!compact.value);
  return {compact,collapsed,toggle:()=>{ui.conversationCollapsed=!ui.conversationCollapsed;},expand:()=>{ui.conversationCollapsed=false;}};
}
