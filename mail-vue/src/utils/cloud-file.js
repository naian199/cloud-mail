// Shared labels and icons for CostAction files.
export const FILE_CATEGORIES = ['image', 'video', 'audio', 'document', 'archive', 'other'];
const ICONS = { image: 'file-image', video: 'file-video', audio: 'file-audio', document: 'file-doc', archive: 'file-archive' };
export const fileIcon = (category) => `cloud-mail:${ICONS[category] || 'file'}`;
