require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const LanguageManager = require('./LanguageManager');
const PlayerController = require('./utils/PlayerController');
const loadCommands = require('./handlers/commandHandler');
const registerEvents = require('./handlers/eventHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.languageManager = new LanguageManager();
client.defaultLanguage = process.env.DEFAULT_LANGUAGE || 'en';

// Shorthand translation helper: client.t(key, ...args)
client.t = function (key, ...args) {
    return this.languageManager.get(this.defaultLanguage, key, ...args);
};

client.playerController = new PlayerController(client);

// Presence management
client.activePlayers = new Map(); // Guild ID -> Track info

client.updatePresence = function() {
    // Get all active players
    const activePlayers = Array.from(this.activePlayers.values());
    
    if (activePlayers.length === 0) {
        // No music playing, set default presence
        const defaultPresence = this.t('LISTENING_TO_MUSIC');
        this.user.setActivity(defaultPresence, { type: 2 }); // Type 2 = LISTENING
    } else {
        // Show the most recently started track
        const mostRecent = activePlayers[activePlayers.length - 1];
        const songTitle = mostRecent.title || this.t('UNKNOWN_TITLE');
        
        // Truncate if too long (Discord has a 128 character limit)
        const truncatedTitle = songTitle.length > 125 ? songTitle.substring(0, 122) + '...' : songTitle;
        this.user.setActivity(truncatedTitle, { type: 2 }); // Type 2 = LISTENING
    }
};

client.lavalink = new LavalinkManager({
    nodes: [
        {
            host: process.env.LAVALINK_HOST,
            port: parseInt(process.env.LAVALINK_PORT),
            authorization: process.env.LAVALINK_PASSWORD,
            id: "main-node",
        },
    ],
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    autoSkip: true,
    playerOptions: {
        clientBasedPositionUpdateInterval: 150,
        defaultSearchPlatform: "ytsearch",
        onEmptyQueue: {
            destroyAfterMs: parseInt(process.env.QUEUE_EMPTY_DESTROY_MS || "30000", 10),
        }
    },
});

// Lavalink events
client.lavalink.on("trackStart", (player, track) => {
    // Update player UI
    client.playerController.updatePlayer(player.guildId);
    
    // Update presence
    client.activePlayers.set(player.guildId, {
        title: track.info?.title,
        startedAt: Date.now()
    });
    client.updatePresence();
});

client.lavalink.on("trackEnd", (player, track, reason) => {
    if (reason === "replaced") return; // Track was replaced, new one will start
    
    // Update player UI
    setTimeout(() => {
        if (player.queue.current) {
            client.playerController.updatePlayer(player.guildId);
        } else {
            client.playerController.deletePlayer(player.guildId);
            
            // Remove from active players and update presence
            client.activePlayers.delete(player.guildId);
            client.updatePresence();
        }
    }, 500);
});

client.lavalink.on("queueEnd", (player) => {
    const guildId = player.guildId;
    const playerMessage = client.playerController.playerMessages.get(guildId);
    if (playerMessage) {
        const textChannel = client.channels.cache.get(playerMessage.channelId);
        if (textChannel) {
            textChannel.send(client.t('QUEUE_ENDED')).catch(() => {});
        }
    }
    client.playerController.deletePlayer(guildId);
    
    // Remove from active players and update presence
    client.activePlayers.delete(guildId);
    client.updatePresence();
});

loadCommands(client);
registerEvents(client);

client.login(process.env.TOKEN); 