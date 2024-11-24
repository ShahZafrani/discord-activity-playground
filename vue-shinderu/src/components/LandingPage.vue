<script setup>
import { ref } from 'vue'
import { DiscordSDK } from "@discord/embedded-app-sdk";

defineProps({
  msg: String,
})

let channelName = ref("unknown");

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
// Will eventually store the authenticated user's access_token
let auth;
setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");
  appendVoiceChannelName();
});
async function appendVoiceChannelName() {
  // Requesting the channel in GDMs (when the guild ID is null) requires
  // the dm_channels.read scope which requires Discord approval.
  if (discordSdk.channelId != null && discordSdk.guildId != null) {
    // Over RPC collect info about the channel
    const channel = await discordSdk.commands.getChannel({channel_id: discordSdk.channelId});
    if (channel.name != null) {
      channelName.value = channel.name;
    }
  }
}

async function setupDiscordSdk() {
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

  <h1>Playing in: {{ channelName }}</h1>
</template>
