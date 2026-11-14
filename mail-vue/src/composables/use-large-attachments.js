import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { randomUUID } from '@/utils/uuid';
import { makePreview } from '@/utils/file-preview';
import { cloudFilePutPreview } from '@/request/cloud-file';
import { largeAttDirect, largeAttComplete, uploadDirect, largeAttBegin, largeAttConfig, largeAttFailed, largeAttRemove } from '@/request/large-att';

// Large attachments chosen in the chat composer, per draft. Each file gets its own request ID,
// so a retry reuses the same server record instead of creating another.
// The server accepts at most this many CostAction files per message.
const MAX_PER_MESSAGE = 10;

export function useLargeAttachments({ t, accountId, draftKey }) {
  const config = ref({ enabled: false, minSize: 0, maxSize: 0 });
  // Resolves once the configuration is known (or could not be loaded), so a file chosen right
  // after the page opens is still routed correctly.
  const ready = largeAttConfig().then((value) => { config.value = value; }).catch(() => {});
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
      const begun = await largeAttBegin({ accountId: accountId(), filename: item.name, size: item.size, mimeType: item.file.type || '', clientId: item.clientId });
      item.attId = begun.attId;
      item.fileId = begun.fileId;
      // Removed while the upload URL was being requested: do not transfer the file.
      if (item.status === 'removed') { largeAttFailed(begun.attId).catch(() => {}); return; }
      if (begun.status !== 'ready') {
        // The file's data goes straight from the browser to the storage program; the Worker only
        // issues the upload URL, then checks that the whole file arrived and records it. Browsers
        // cannot report progress for this upload without a preflight the hosts refuse, so the
        // list shows elapsed time.
        item.direct = true;
        item.startedAt = Date.now();
        const target = await largeAttDirect(begun.attId);
        if (target.status !== 'ready') {
          const remoteId = await uploadDirect(target.uploadUrl, item.file, { signal: item.controller.signal });
          // The storage program has received all of the data; now the Worker verifies it.
          item.progress = 1;
          const done = await largeAttComplete({ attId: begun.attId, remoteId });
          item.verifiedSize = done.size ?? item.size;
        }
      }
      // Already verified earlier (a retry after a lost reply) when no size came back here.
      if (!item.verifiedSize) item.verifiedSize = item.size;
      item.status = 'ready';
      item.progress = 1;
      // The original is stored; a preview is extra. Its failure never re-uploads the original.
      storePreview(item);
    } catch (error) {
      if (item.status === 'removed') return;
      item.status = 'failed';
      if (item.attId) largeAttFailed(item.attId).catch(() => {});
      if (error?.message === 'upload-direct-network') ElMessage.error(t('largeAttDirectFailed'));
      else ElMessage.error(t('largeAttUploadFailed'));
    }
  }

  async function storePreview(item) {
    if (!item.fileId || item.previewStored) return;
    const blob = await makePreview(item.file);
    if (!blob) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await cloudFilePutPreview(item.fileId, blob);
        item.previewStored = true;
        return;
      } catch {}
    }
  }

  function choose(event) {
    const chosen = [...(event.target?.files || [])];
    if (event.target) event.target.value = '';
    const { maxSize } = config.value;
    for (const file of chosen) {
      if (list().length >= MAX_PER_MESSAGE) {
        ElMessage.error(t('largeAttCountLimit', { count: MAX_PER_MESSAGE }));
        break;
      }
      if (file.size < 1 || file.size > maxSize) {
        ElMessage.error(t('largeAttMaxLimit', { max: Math.round(maxSize / 1048576) }));
        continue;
      }
      const item = reactive({ clientId: randomUUID().replaceAll('-', ''), file, name: file.name, size: file.size, progress: 0, status: 'uploading', attId: null, fileId: null, previewStored: false, controller: null, direct: false, startedAt: 0, verifiedSize: 0 });
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

  return { ready, config, uploads, list, readyIds, busy, clear, retry: upload, choose, remove };
}
