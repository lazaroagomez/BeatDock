require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const LanguageManager = require('./LanguageManager');
const PlayerController = require('./utils/PlayerController');
const LavalinkConnectionManager = require('./utils/LavalinkConnectionManager');
const searchSessions = require('./utils/searchSessions');
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
        this.user.setActivity(defaultPresence, { type: ActivityType.Listening });
    } else {
        // Show the most recently started track
        const mostRecent = activePlayers[activePlayers.length - 1];
        const songTitle = mostRecent.title || this.t('UNKNOWN_TITLE');
        
        // Truncate if too long (Discord has a 128 character limit)
        const truncatedTitle = songTitle.length > 125 ? songTitle.substring(0, 122) + '...' : songTitle;
        this.user.setActivity(truncatedTitle, { type: ActivityType.Listening });
    }
};

client.lavalink = new LavalinkManager({
    nodes: [
        {
            host: process.env.LAVALINK_HOST,
            port: parseInt(process.env.LAVALINK_PORT),
            authorization: process.env.LAVALINK_PASSWORD,
            id: "main-node",
            reconnectTimeout: 10000,
            reconnectTries: 3,
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

// Initialize connection manager
client.lavalinkConnectionManager = new LavalinkConnectionManager(client);

// Initialize the connection manager immediately - it will monitor for Lavalink availability
client.lavalinkConnectionManager.initialize();

// Lavalink NodeManager events
client.lavalink.nodeManager.on('connect', (node) => {
    client.lavalinkConnectionManager.onConnect(node);
});

client.lavalink.nodeManager.on('error', (node, error) => {
    client.lavalinkConnectionManager.onError(node, error);
});

client.lavalink.nodeManager.on('disconnect', (node, reason) => {
    client.lavalinkConnectionManager.onDisconnect(node, reason);
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

// Graceful shutdown handling
const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    // Cleanup connection manager
    client.lavalinkConnectionManager.destroy();
    
    // Clear cleanup interval
    searchSessions.destroy();
    
    // Destroy Lavalink nodes
    for (const node of client.lavalink.nodeManager.nodes.values()) {
        await node.destroy();
    }
    
    // Destroy Discord client
    await client.destroy();
    
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(process.env.TOKEN);