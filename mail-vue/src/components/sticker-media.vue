<template>
  <div ref="host" class="sticker-media" :aria-label="label" :aria-busy="loading">
    <img v-if="url && format === 'webp'" :src="url" :alt="label" />
    <video
      v-else-if="url && format === 'webm'"
      :src="url"
      autoplay
      loop
      muted
      playsinline
      :aria-label="label"
      @error="failed = true"
    />
    <div
      v-else-if="format === 'tgs' && !failed"
      ref="animationHost"
      class="sticker-animation"
    ></div>
    <span v-if="failed || loading" class="sticker-fallback">{{ label || '🙂' }}</span>
  </div>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Gunzip } from 'fflate';
const props = defineProps({
  load: { type: Function, required: true },
  format: String,
  label: String
});
const host = ref(null),
  animationHost = ref(null),
  url = ref(''),
  loading = ref(false),
  failed = ref(false);
let observer,
  animation,
  disposed = false,
  started = false;
function decode(bytes) {
  let total = 0;
  const chunks = [];
  const unzip = new Gunzip((chunk) => {
    total += chunk.length;
    if (total > 4 * 1024 * 1024) throw Error('Animation too large');
    chunks.push(chunk);
  });
  for (let offset = 0; offset < bytes.length; offset += 256)
    unzip.push(bytes.subarray(offset, offset + 256), offset + 256 >= bytes.length);
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  const data = JSON.parse(new TextDecoder().decode(all));
  if (
    !data ||
    !Number.isFinite(data.w) ||
    !Number.isFinite(data.h) ||
    data.w > 1024 ||
    data.h > 1024 ||
    data.w < 1 ||
    data.h < 1 ||
    !Array.isArray(data.layers) ||
    !Number.isFinite(data.fr) ||
    data.fr < 1 ||
    data.fr > 120 ||
    !Number.isFinite(data.op) ||
    !Number.isFinite(data.ip) ||
    data.op - data.ip > 3600 ||
    data.op <= data.ip ||
    data.fonts ||
    data.chars
  )
    throw Error('Invalid animation');
  let nodes = 0;
  function check(value, depth = 0) {
    if (++nodes > 100000 || depth > 80) throw Error('Complex animation');
    if (value && typeof value === 'object') {
      if (typeof value.x === 'string' || value.u || typeof value.p === 'string')
        throw Error('External animation resource');
      for (const child of Object.values(value)) check(child, depth + 1);
    }
  }
  check(data);
  return data;
}
async function start() {
  if (started || disposed) return;
  started = true;
  loading.value = true;
  try {
    const blob = await props.load();
    if (blob.size > 1024 * 1024) throw Error('Sticker too large');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (disposed) return;
    if (props.format === 'tgs') {
      const data = decode(bytes);
      const { default: lottie } = await import('lottie-web/build/player/lottie_light.min.js');
      await nextTick();
      if (disposed) return;
      animation = lottie.loadAnimation({
        container: animationHost.value,
        renderer: 'svg',
        loop: true,
        autoplay: !matchMedia('(prefers-reduced-motion: reduce)').matches,
        animationData: data,
        rendererSettings: { progressiveLoad: true }
      });
    } else {
      const webp =
        String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
      const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
      if (!(props.format === 'webp' ? webp : webm)) throw Error('Invalid sticker');
      url.value = URL.createObjectURL(
        new Blob([bytes], { type: props.format === 'webp' ? 'image/webp' : 'video/webm' })
      );
    }
  } catch {
    if (!disposed) failed.value = true;
  } finally {
    if (!disposed) loading.value = false;
  }
}
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        start();
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animation?.play();
        host.value
          ?.querySelector('video')
          ?.play()
          .catch(() => {});
      } else {
        animation?.pause();
        host.value?.querySelector('video')?.pause();
      }
    }
  });
  observer.observe(host.value);
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  animation?.destroy();
  if (url.value) URL.revokeObjectURL(url.value);
});
</script>
<style scoped>
.sticker-media {
  position: relative;
  width: 160px;
  height: 160px;
  max-width: 100%;
  display: grid;
  place-items: center;
}
img,
video,
.sticker-animation {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.sticker-fallback {
  position: absolute;
  font-size: 32px;
}
</style>
