import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fileToBase64 } from '@/utils/file-utils';

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

// Attachments waiting to be sent, per draft: chosen, pasted, dropped or picked as stickers.
// The arguments are getters because the chat view declares some of them later in setup.
//   draftKey(): the draft the composer is editing.
//   canAccept(): whether the open thread can take files right now (open, may send, not sending).
//   selecting(): whether message selection mode is on (paste is ignored then).
//   isStopped(): whether the view has been torn down.
export function useChatAttachments({ t, draftKey, canAccept, selecting, isStopped }) {
  // files[draft] holds encoded attachments; fileReads[draft] counts files still being read.
  const files = reactive({});
  const fileReads = reactive({});
  const dragDepth = ref(0);

  function addSticker(file) {
    const current = draftKey(), existing = files[current] || [];
    const pending = fileReads[current] || { count: 0, size: 0 };
    if (existing.length + pending.count >= MAX_FILES || existing.reduce((n, f) => n + f.size, 0) + pending.size + file.size > MAX_BYTES) { ElMessage.error(t('mailChatFileLimit')); return; }
    files[current] = [...existing, file];
  }

  const draggedFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  function dragEnter(event) {
    if (!draggedFiles(event)) return;
    event.preventDefault();
    if (canAccept()) dragDepth.value++;
  }
  function dragOver(event) {
    if (!draggedFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = canAccept() ? 'copy' : 'none';
  }
  function dragLeave(event) { if (draggedFiles(event) || dragDepth.value) dragDepth.value = Math.max(0, dragDepth.value - 1); }
  function pasteFiles(event) {
    const pasted = [...(event.clipboardData?.files || [])];
    if (!pasted.length || !canAccept() || selecting()) return;
    event.preventDefault();
    chooseFiles({ target: { files: pasted, value: '' } }, draftKey());
  }
  function dropFiles(event) {
    if (!draggedFiles(event)) return;
    event.preventDefault(); dragDepth.value = 0;
    if (!canAccept()) { ElMessage.info(t('mailChatChoose')); return; }
    if ([...(event.dataTransfer.items || [])].some(item => item.webkitGetAsEntry?.()?.isDirectory)) { ElMessage.error(t('mailChatFileError')); return; }
    chooseFiles({ target: { files: event.dataTransfer.files, value: '' } }, draftKey());
  }

  async function chooseFiles(event, current = draftKey()) {
    const chosen = [...(event.target?.files || [])];
    if (event.target) event.target.value = '';
    if (!chosen.length) return;
    const existing = files[current] || [], pending = fileReads[current] || { count: 0, size: 0 };
    const size = chosen.reduce((n, f) => n + f.size, 0);
    if (existing.length + pending.count + chosen.length > MAX_FILES ||
        existing.reduce((n, f) => n + f.size, 0) + pending.size + size > MAX_BYTES) {
      ElMessage.error(t('mailChatFileLimit')); return;
    }
    fileReads[current] = { count: pending.count + chosen.length, size: pending.size + size };
    try {
      const added = await Promise.all(chosen.map(async f => ({ filename: f.name, size: f.size,
        contentType: /\.tgs$/i.test(f.name) ? 'application/x-tgsticker' : f.type || 'application/octet-stream',
        content: await fileToBase64(f) })));
      if (!isStopped()) files[current] = [...(files[current] || []), ...added];
    } catch { ElMessage.error(t('mailChatFileError')); }
    finally {
      const remaining = fileReads[current];
      if (remaining) {
        remaining.count -= chosen.length; remaining.size -= size;
        if (!remaining.count) delete fileReads[current];
      }
    }
  }

  return { files, fileReads, dragDepth, addSticker, dragEnter, dragOver, dragLeave, pasteFiles, dropFiles, chooseFiles };
}
