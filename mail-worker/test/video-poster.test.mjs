import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { queueVideoPreview } from '../../mail-vue/src/utils/video-poster.mjs';

test('poster queue bounds concurrent attachment reads and decoding to two', async () => {
  let running = 0, peak = 0;
  const tasks = Array.from({ length: 7 }, (_, index) => queueVideoPreview(async () => {
    running++; peak = Math.max(peak, running);
    await setImmediate(); running--; return index;
  }));
  assert.deepEqual(await Promise.all(tasks), [0,1,2,3,4,5,6]);
  assert.equal(peak, 2);
});

test('a cancelled offscreen preview leaves the queue without reading its attachment', async () => {
  let release, called = false;
  const gate = new Promise(resolve => { release = resolve; });
  const first = queueVideoPreview(() => gate), second = queueVideoPreview(() => gate);
  const controller = new AbortController();
  const cancelled = assert.rejects(queueVideoPreview(() => { called = true; }, controller.signal), { name: 'AbortError' });
  controller.abort(); release();
  await Promise.all([first, second, cancelled]);
  assert.equal(called, false);
});

test('decoder failure releases its slot for subsequent previews', async () => {
  const failed = assert.rejects(queueVideoPreview(() => { throw Error('Corrupt video'); }), /Corrupt video/);
  assert.equal(await queueVideoPreview(async () => 'next poster'), 'next poster');
  await failed;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(queueVideoPreview(() => { throw Error('Must not run'); }, controller.signal), { name: 'AbortError' });
});
