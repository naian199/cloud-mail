<template>
  <div class="percent">
    <BrandLoading :size="24" />
    <div>
      <span>{{value}}%</span>
      <span style="margin-left: 5px">{{desc}}</span>
    </div>
  </div>
</template>
<script setup>

defineProps({
  value: [Number,String],
  desc: [String]
})
</script>

<style scoped lang="scss">
.percent {
  display: flex;
  gap: 10px;
}
</style>