// Classification of large attachments for the remote folder tree.

// Remote folder names, by category, under Cloud-Mail/<category>/<year>/<month>.
export const CATEGORIES = { image: '图片', video: '视频', audio: '音频', document: '文档', archive: '压缩包', other: '其他' };
const EXT = {
	image: /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|svg|tiff?)$/i,
	video: /\.(mp4|m4v|mov|mkv|avi|wmv|flv|webm|3gp|ts|mpe?g)$/i,
	audio: /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma|amr|ape)$/i,
	document: /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|md|csv|epub|pages|numbers|key)$/i,
	archive: /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|zst|iso|dmg|apk|ipa|exe|msi)$/i
};

export function categoryOf(filename = '', mime = '') {
	const type = String(mime).toLowerCase();
	if (type.startsWith('image/')) return 'image';
	if (type.startsWith('video/')) return 'video';
	if (type.startsWith('audio/')) return 'audio';
	for (const [category, pattern] of Object.entries(EXT)) if (pattern.test(filename)) return category;
	if (type === 'application/pdf' || type.startsWith('text/')) return 'document';
	return 'other';
}

// Folder path for a file uploaded at `time` (unix seconds, UTC).
export function folderPath(category, time) {
	const date = new Date(time * 1000);
	return ['Cloud-Mail', CATEGORIES[category] || CATEGORIES.other, String(date.getUTCFullYear()), String(date.getUTCMonth() + 1).padStart(2, '0')];
}
