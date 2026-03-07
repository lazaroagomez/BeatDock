require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// Helper function for ISO 8601 timestamps
const timestamp = () => new Date().toISOString();

// Global error handlers to prevent crashes from unhandled WebSocket errors
process.on('uncaughtException', (error) => {
    console.error(`[${timestamp()}] Uncaught Exception: ${error.message}`);
    console.error(error.stack);
    // Don't exit - let the bot continue
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${timestamp()}] Unhandled Rejection at:`, promise, 'reason:', reason);
    // Don't exit - let the bot continue
});

const { LavalinkManager } = require('lavalink-client');
const LanguageManager = require('./LanguageManager');
const PlayerController = require('./utils/PlayerController');
const LavalinkConnectionManager = require('./utils/LavalinkConnectionManager');
const nodeProvider = require('./utils/LavalinkNodeProvider');
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
        // No music playing, clear presence
        this.user.setActivity(null);
    } else if (activePlayers.length === 1) {
        // Only one server playing music, show generic message
        const genericPresence = this.t('PLAYING_MUSIC_GENERIC');
        this.user.setActivity(genericPresence, { type: ActivityType.Listening });
    } else {
        // Multiple servers playing music, show server count
        const serverCountPresence = this.t('PLAYING_MUSIC_IN_SERVERS', activePlayers.length);
        this.user.setActivity(serverCountPresence, { type: ActivityType.Listening });
    }
};

// Create LavalinkManager with empty nodes - will be populated by node provider
client.lavalink = new LavalinkManager({
    nodes: [], // Nodes will be added dynamically by the node provider
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

// Track which nodes have had SponsorBlock info logged
const sponsorBlockLoggedNodes = new Set();

// Lavalink NodeManager events
client.lavalink.nodeManager.on('connect', (node) => {
    client.lavalinkConnectionManager.onConnect(node);
    
    // Log SponsorBlock status once per node on connection
    const nodeInfo = node?.info;
    const pluginNames = nodeInfo?.plugins?.map(p => p.name) || [];
    const hasSponsorBlockPlugin = pluginNames.includes('sponsorblock-plugin');
    
    if (pluginNames.length > 0) {
        console.log(`[${timestamp()}] [SponsorBlock] Node "${node?.id}" plugins: ${pluginNames.join(', ')}`);
    }
    
    if (hasSponsorBlockPlugin) {
        const segments = (process.env.SPONSORBLOCK_SEGMENTS || 'intro,sponsor,selfpromo,music_offtopic').split(',').map(s => s.trim());
        console.log(`[${timestamp()}] [SponsorBlock] Will skip segments: ${segments.join(', ')}`);
        sponsorBlockLoggedNodes.add(node?.id);
    } else {
        console.log(`[${timestamp()}] [SponsorBlock] Plugin not available on node "${node?.id}"`);
    }
});

client.lavalink.nodeManager.on('error', (node, error) => {
    client.lavalinkConnectionManager.onError(node, error);
});

client.lavalink.nodeManager.on('disconnect', (node, reason) => {
    client.lavalinkConnectionManager.onDisconnect(node, reason);
    sponsorBlockLoggedNodes.delete(node?.id);
});

client.lavalink.on("trackStart", async (player, track) => {
    // Log track start with server and track info
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Unknown Server';
    const trackTitle = track.info?.title || 'Unknown';
    const trackAuthor = track.info?.author || 'Unknown';
    const trackUri = track.info?.uri || '';
    console.log(`[${timestamp()}] [Music] Playing in "${guildName}" (${player.guildId}) | Channel: ${player.voiceChannelId} | ${trackTitle} by ${trackAuthor} | ${trackUri}`);
    
    // Enable SponsorBlock for YouTube tracks to skip intros, sponsors, etc.
    const sponsorBlockEnabled = process.env.SPONSORBLOCK_ENABLED !== 'false';
    if (sponsorBlockEnabled && track.info?.sourceName === 'youtube') {
        // Check if the node has the SponsorBlock plugin
        const nodeInfo = player.node?.info;
        const pluginNames = nodeInfo?.plugins?.map(p => p.name) || [];
        const hasSponsorBlockPlugin = pluginNames.includes('sponsorblock-plugin');
        
        if (hasSponsorBlockPlugin) {
            try {
                // Segments: intro, outro, sponsor, selfpromo, interaction, music_offtopic, preview, filler
                const segments = (process.env.SPONSORBLOCK_SEGMENTS || 'intro,sponsor,selfpromo,music_offtopic').split(',').map(s => s.trim());
                await player.setSponsorBlock(segments);
            } catch (err) {
                // SponsorBlock plugin might not be available on this node
                console.log(`[${timestamp()}] [SponsorBlock] Error: ${err.message}`);
            }
        }
    }
    
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
    // reason can be an object with a 'reason' property or a string
    const reasonStr = typeof reason === 'object' ? (reason?.reason || JSON.stringify(reason)) : String(reason);
    
    if (reasonStr === "replaced") return; // Track was replaced, new one will start
    
    // Log track end
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Unknown Server';
    const trackTitle = track?.info?.title || 'Unknown';
    console.log(`[${timestamp()}] [Music] Ended in "${guildName}" (${player.guildId}) | ${trackTitle} | Reason: ${reasonStr}`);
    
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

client.lavalink.on("trackError", (player, track, error) => {
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Unknown Server';
    const trackTitle = track?.info?.title || 'Unknown';
    const trackUri = track?.info?.uri || '';
    console.error(`[${timestamp()}] [Music] Error in "${guildName}" (${player.guildId}) | ${trackTitle} | ${trackUri} | Error: ${error?.message || error}`);
});

client.lavalink.on("trackStuck", (player, track, threshold) => {
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Unknown Server';
    const trackTitle = track?.info?.title || 'Unknown';
    console.warn(`[${timestamp()}] [Music] Stuck in "${guildName}" (${player.guildId}) | ${trackTitle} | Threshold: ${threshold}ms`);
});

// SponsorBlock events
client.lavalink.on("SegmentSkipped", (player, track, payload) => {
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Unknown Server';
    const trackTitle = track?.info?.title || 'Unknown';
    const category = payload?.segment?.category || 'unknown';
    const duration = payload?.segment ? Math.round((payload.segment.end - payload.segment.start) / 1000) : 0;
    console.log(`[${timestamp()}] [SponsorBlock] Skipped ${category} (${duration}s) in "${guildName}" | ${trackTitle}`);
});

client.lavalink.on("SegmentsLoaded", (player, track, payload) => {
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Unknown Server';
    const trackTitle = track?.info?.title || 'Unknown';
    const segmentCount = payload?.segments?.length || 0;
    if (segmentCount > 0) {
        console.log(`[${timestamp()}] [SponsorBlock] Loaded ${segmentCount} segment(s) for "${trackTitle}" in "${guildName}"`);
    }
});

client.lavalink.on("queueEnd", (player) => {
    const guildId = player.guildId;
    const guild = client.guilds.cache.get(guildId);
    const guildName = guild?.name || 'Unknown Server';
    console.log(`[${timestamp()}] [Music] Queue ended in "${guildName}" (${guildId})`);
    
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
    console.log(`[${timestamp()}] Received ${signal}, shutting down gracefully...`);
    
    // Cleanup connection manager
    client.lavalinkConnectionManager.destroy();
    
    // Clear cleanup interval
    searchSessions.destroy();
    
    // Destroy Lavalink nodes (clear heartbeat intervals first)
    for (const node of client.lavalink.nodeManager.nodes.values()) {
        if (node.heartBeatInterval) {
            clearInterval(node.heartBeatInterval);
            node.heartBeatInterval = null;
        }
        if (node.pingTimeout) {
            clearTimeout(node.pingTimeout);
            node.pingTimeout = null;
        }
        await node.destroy();
    }
    
    // Destroy Discord client
    await client.destroy();
    
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(process.env.TOKEN);