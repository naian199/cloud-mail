<template>
 <el-popover v-if="profile?.officialVerified===true||profile?.officialVerified===1" v-model:visible="open" trigger="click" width="260" :title="t('officialVerified')">
  <p class="official-subject">{{ profile.officialSubject }}</p><p>{{ profile.officialDescription }}</p><small>{{ t('officialExplanation') }}</small>
  <template #reference><span class="official-badge" role="button" tabindex="0" :aria-label="t('officialVerified')" :aria-expanded="open" @click.stop @keydown.enter.stop.prevent="open=!open" @keydown.space.stop.prevent="open=!open" @keydown.esc.stop="open=false"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#5574ff" d="m12 1 3 2 3.6.4 1.1 3.5L22 10l-.8 3.5.1 3.5-3.2 1.7-2.3 2.7-3.5-.7-3.5.7-2.3-2.7L3.3 17l.1-3.5L2.6 10l2.3-3.1L6 3.4 9.6 3z"/><path d="m7.5 11.8 3 3 6-6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></template>
 </el-popover>
</template>
<script setup>
import {ref} from 'vue';import {useI18n} from 'vue-i18n';defineProps({profile:Object});const {t}=useI18n();const open=ref(false);
</script>
<style scoped>.official-badge{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;margin-inline-start:5px;flex-shrink:0;cursor:pointer;line-height:1;}.official-badge:focus-visible{outline:2px solid #5574ff;outline-offset:3px;border-radius:50%;}.official-subject{font-weight:600;overflow-wrap:anywhere;}</style>
