import test from 'node:test';
import assert from 'node:assert/strict';
import { isStickerFile, isVideoFile, videoMime } from '../../mail-vue/src/utils/video-files.mjs';

test('video attachments are recognized even when stored as generic binary files', () => {
  for (const extension of ['mp4','MP4','m4v','mov','webm','mkv','avi','wmv','flv','mpg','mpeg','ts','mts','m2ts','3gp','vob','mxf','rmvb','hevc'])
    assert(isVideoFile({ filename: `clip.${extension}`, mimeType: 'application/octet-stream' }), extension);
  assert.equal(videoMime({ filename: 'WhatsApp Video.mp4' }), 'video/mp4');
  assert(isVideoFile({ filename: 'clip.unknown', mimeType: 'video/mp4' }));
  for (const filename of ['video.mp4.txt', 'notes.pdf', 'photo.svg', 'page.html'])
    assert(!isVideoFile({ filename, mimeType: 'application/octet-stream' }), filename);
});

test('ordinary WebM videos are distinct from explicitly named sticker attachments', () => {
  assert(isVideoFile({ filename: 'recording.webm' }));
  assert(!isStickerFile({ filename: 'recording.webm' }));
  for (const filename of ['sticker.webm', 'sticker-123.webm', 'sticker_123.WEBM', 'animation.tgs']) {
    assert(isStickerFile({ filename }), filename);
    assert(!isVideoFile({ filename, mimeType: 'video/webm' }), filename);
  }
});
