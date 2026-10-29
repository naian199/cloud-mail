<template><template v-for="(part,index) in chatLinkParts(text)" :key="index"><a v-if="part.url" :href="part.url" @click="openLinkBrowser(part.url, $event)" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{ part.text }}</a><template v-else>{{ part.text }}</template></template></template>
<script setup>
import { openLinkBrowser } from '@/composables/use-link-browser';
import { chatLinkParts } from '@/utils/chat-links.mjs';
defineProps({ text:{type:String,default:''} });
</script>
<style scoped>
a { color:var(--chat-accent,var(--el-color-primary)); text-decoration:underline; text-underline-offset:2px; overflow-wrap:anywhere; }
a:focus-visible { outline:2px solid currentColor;outline-offset:2px; }
</style>
