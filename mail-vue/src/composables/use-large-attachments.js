import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { randomUUID } from '@/utils/uuid';
import { largeAttBegin, largeAttComplete, largeAttConfig, largeAttFailed, largeAttRemove, uploadToStorage } from '@/request/large-att';

// Large attachments chosen in the chat composer, per draft. Each file gets its own request ID,
// so a retry reuses the same server record instead of creating another.
export function useLargeAttachments({ t, accountId, draftKey }) {
  const config = ref({ enabled: false, minSize: 0, maxSize: 0 });
  largeAttConfig().then((value) => { config.value = value; }).catch(() => {});
  const uploads = reactive({});

  const list = (key = draftKey()) => uploads[key] || (uploads[key] = []);
  const readyIds = (key = draftKey()) => (uploads[key] || []).filter((item) => item.status === 'ready').map((item) => item.attId);
  const busy = (key = draftKey()) => (uploads[key] || []).some((item) => item.status === 'uploading');
  const clear = (key = draftKey()) => { uploads[key] = (uploads[key] || []).filter((item) => item.status !== 'ready'); };

  async function upload(item) {
    item.status = 'uploading';
    item.progress = 0;
    item.controller = new AbortController();
    try {
      const begun = await largeAttBegin({ accountId: accountId(), filename: item.name, size: item.size, clientId: item.clientId });
      item.attId = begun.attId;
      if (begun.status !== 'ready') {
        const remoteId = await uploadToStorage(begun.uploadUrl, item.file, { signal: item.controller.signal, onProgress: (p) => { item.progress = p; } });
        await largeAttComplete({ attId: begun.attId, remoteId });
      }
      item.status = 'ready';
      item.progress = 1;
    } catch (error) {
      if (item.status === 'removed') return;
      item.status = 'failed';
      if (item.attId) largeAttFailed(item.attId).catch(() => {});
      if (error?.message?.startsWith('upload-')) ElMessage.error(t('largeAttUploadFailed'));
    }
  }

  function choose(event) {
    const chosen = [...(event.target?.files || [])];
    if (event.target) event.target.value = '';
    const { minSize, maxSize } = config.value;
    for (const file of chosen) {
      if (file.size < minSize || file.size > maxSize) {
        ElMessage.error(t('largeAttSizeLimit', { min: Math.round(minSize / 1048576), max: Math.round(maxSize / 1048576) }));
        continue;
      }
      const item = reactive({ clientId: randomUUID().replaceAll('-', ''), file, name: file.name, size: file.size, progress: 0, status: 'uploading', attId: null, controller: null });
      list().push(item);
      upload(item);
    }
  }

  async function remove(item, key = draftKey()) {
    const previous = item.status;
    item.status = 'removed';
    item.controller?.abort();
    uploads[key] = (uploads[key] || []).filter((row) => row !== item);
    // A finished upload that was never sent is deleted from the storage service too.
    if (previous === 'ready' && item.attId) largeAttRemove(item.attId).catch(() => {});
  }

  return { config, uploads, list, readyIds, busy, clear, retry: upload, choose, remove };
}
