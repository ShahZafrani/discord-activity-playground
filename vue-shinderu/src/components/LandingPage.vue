<script setup>
import { inject } from 'vue'
import { doc } from 'firebase/firestore';
import { computed } from 'vue';
import { useDocument, useFirestore } from 'vuefire';
import { useRouter } from 'vue-router'
const router = useRouter();
defineProps({
  msg: String,
})
function startGame() {
      router.push('/game');
}
const db = useFirestore();
const testDoc = computed(() =>
  doc(db, 'test', 'new-test'));

const message = useDocument(testDoc);
const channelName = inject('channelName')
const channelId = inject('channelId')
const username = inject('username')
const userAvatarSrc = inject('userAvatarSrc')
</script>

<template>
  <h1>{{ msg }}</h1>

  <h2>Playing in: {{ channelName }}</h2>
  <h2>{{ channelId }}</h2>
  <h3>message: {{ message }}</h3>
  <h4>player: {{ username }}</h4>
  <img v-bind:src="userAvatarSrc">
  <button @click="startGame">Start a Game!</button>
</template>
