import { computed } from 'vue';
import { useUiStore } from '@/store/ui';
import { useBreakpoint } from '@/composables/use-breakpoint';
export function useConversationSidebar() {
  const ui=useUiStore();
  const compact=useBreakpoint().isPhone;
  const collapsed=computed(()=>ui.conversationCollapsed===true&&!compact.value);
  return {compact,collapsed,toggle:()=>{ui.conversationCollapsed=!ui.conversationCollapsed;},expand:()=>{ui.conversationCollapsed=false;}};
}
