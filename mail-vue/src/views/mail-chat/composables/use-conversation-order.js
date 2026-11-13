import { ref } from 'vue';
import { moveConversation } from '@/utils/conversation-order.mjs';

// Manual ordering of the conversation list (drag and drop, Alt+Arrow keys) and
// opening a conversation's menu with a touch long press.
export function useConversationOrder({ conversations, sortedConversations, customOrder, orderScope, ui, select, openConversationMenu, closeMenu }) {
  const draggingKey = ref(''), dropTarget = ref(null);
  let contactPress, contactPressStart, suppressContactUntil = 0;

  function saveOrder(keys) {
    const entries = Object.entries(ui.conversationOrders).filter(([key]) => key !== orderScope.value).slice(-19);
    const merged = keys.length ? [...keys, ...customOrder.value.filter(key => !keys.includes(key))] : [];
    ui.conversationOrders = Object.fromEntries([...entries, [orderScope.value, merged.slice(0, 1000)]]);
  }
  // A long press or a drag ends with a click; that click must not also open the conversation.
  function contactClick(event, c) { if (Date.now() < suppressContactUntil) { event.preventDefault(); return; } select(c); }
  function cancelContactPress() { clearTimeout(contactPress); contactPressStart = null; }
  function startContactPress(event, c) {
    if (event.pointerType !== 'touch') return;
    cancelContactPress(); contactPressStart = { x: event.clientX, y: event.clientY };
    const point = { clientX: event.clientX, clientY: event.clientY, currentTarget: event.currentTarget, preventDefault() {} };
    contactPress = setTimeout(() => { suppressContactUntil = Date.now() + 800; openConversationMenu(point, c); }, 500);
  }
  function moveContactPress(event) { if (contactPressStart && Math.hypot(event.clientX - contactPressStart.x, event.clientY - contactPressStart.y) > 10) cancelContactPress(); }
  function startConversationDrag(event, c) {
    closeMenu(); cancelContactPress(); draggingKey.value = c.key;
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-cloud-mail-conversation', c.key);
  }
  // Pinned and unpinned conversations reorder only among themselves.
  function overConversation(event, c) {
    if (!draggingKey.value || draggingKey.value === c.key) return;
    const source = conversations.value.find(row => row.key === draggingKey.value);
    if (!source || !!source.pinned !== !!c.pinned) { dropTarget.value = null; event.dataTransfer.dropEffect = 'none'; return; }
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    const box = event.currentTarget.getBoundingClientRect(); dropTarget.value = { key: c.key, after: event.clientY > box.top + box.height / 2 };
  }
  function leaveConversation(event) { if (!event.currentTarget.contains(event.relatedTarget)) dropTarget.value = null; }
  function dropConversation(event, c) {
    if (!draggingKey.value) return;
    event.preventDefault(); event.stopPropagation();
    if (dropTarget.value?.key === c.key) { const keys = moveConversation(sortedConversations.value, draggingKey.value, c.key, dropTarget.value.after); if (keys) saveOrder(keys); }
    endConversationDrag();
  }
  function endConversationDrag() { if (draggingKey.value) suppressContactUntil = Date.now() + 250; draggingKey.value = ''; dropTarget.value = null; }
  function neighbor(c, delta) { const rows = sortedConversations.value, index = rows.findIndex(row => row.key === c.key), target = rows[index + delta]; return target && !!target.pinned === !!c.pinned ? target : null; }
  function moveContact(c, delta) { const target = neighbor(c, delta); if (!target) return; const keys = moveConversation(sortedConversations.value, c.key, target.key, delta > 0); if (keys) saveOrder(keys); }
  function contactKey(event, c) {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); openConversationMenu(event, c); }
    else if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); moveContact(c, event.key === 'ArrowUp' ? -1 : 1); }
  }

  return {
    draggingKey, dropTarget, saveOrder, contactClick, cancelContactPress, startContactPress, moveContactPress,
    startConversationDrag, overConversation, leaveConversation, dropConversation, endConversationDrag, neighbor, moveContact, contactKey
  };
}
