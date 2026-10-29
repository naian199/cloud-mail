<template>
  <span class="brand-loader" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true"></span>
</template>
<script setup>
defineProps({ size: { type: Number, default: 40 } });
</script>
