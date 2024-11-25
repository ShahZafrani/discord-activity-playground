<script setup>
import { inject } from 'vue'
const initializeDiscord = inject('initializeDiscord');
initializeDiscord();
</script>

<template>
  <main>
    <RouterView />
  </main>
</template>

<style scoped>

</style>
