<script setup>
import { ref } from 'vue'
import { DiscordSDK } from "@discord/embedded-app-sdk";
import {
  doc,
  increment,
  serverTimestamp,
  Timestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { computed } from 'vue';
import { useDocument, useFirestore } from 'vuefire';
import { useRoute, useRouter } from 'vue-router'
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
let channelName = ref("loading channel name...");
let channelId = ref("channelId")
let username = ref("user")
let userAvatarSrc = ref("https://cdn.discordapp.com/emojis/1072346291281084416.png?size=128")

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
// Will eventually store the authenticated user's access_token
let auth;
setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");
  appendVoiceChannelName();
  getPlayerInfo();
});
async function appendVoiceChannelName() {
  // Requesting the channel in GDMs (when the guild ID is null) requires
  // the dm_channels.read scope which requires Discord approval.
  if (discordSdk.channelId != null && discordSdk.guildId != null) {
    // Over RPC collect info about the channel
    const channel = await discordSdk.commands.getChannel({channel_id: discordSdk.channelId});
    if (channel.name != null) {
      channelName.value = channel.name;
      channelId.value = channel.id;
    }
  }
}

async function getPlayerInfo() {
  const user = await fetch(`https://discord.com/api/v10/users/@me`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  username.value = user.global_name;
  userAvatarSrc.value = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

async function setupDiscordSdk() {
    console.log(import.meta.env.VITE_DISCORD_CLIENT_ID);
    await discordSdk.ready();
    console.log("Discord SDK is ready");
    // Authorize with Discord Client
    const { code } = await discordSdk.commands.authorize({
      client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: [
        "identify",
        "guilds",
        "applications.commands"
      ],
    });

  const response = await fetch("/.proxy/fapi/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    channelName = "auth failed"
  }
}
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
