import { ref } from 'vue'
import { DiscordSDK } from "@discord/embedded-app-sdk";

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
// Will eventually store the authenticated user's access_token
let auth;

const channelName = ref("loading channel name...");
const channelId = ref("channelId")
const username = ref("user")
const userAvatarSrc = ref("https://cdn.discordapp.com/emojis/1072346291281084416.png?size=128")
function initialize() {
    setupDiscordSdk().then(() => {
        console.log("Discord SDK is authenticated");
        appendVoiceChannelName();
        getPlayerInfo();
      });
}


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
    console.log("Initialising Discord SDK");
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


export default {
  install: (app, options) => {
    // inject a globally available $translate() method
    app.provide("initializeDiscord", initialize)
    app.provide("channelName", channelName);
    app.provide("channelId", channelId);
    app.provide("username", username);
    app.provide("userAvatarSrc", userAvatarSrc);
    app.provide("discordSDK", discordSdk);
  }
}
