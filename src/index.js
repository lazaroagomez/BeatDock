require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
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

// Presence management with memory leak prevention
client.activePlayers = new Map(); // Guild ID -> Track info
const MAX_ACTIVE_PLAYERS = 1000; // Prevent unbounded growth
const CLEANUP_INTERVAL = 60000; // 1 minute

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

// Periodic cleanup to prevent memory leaks
client.cleanupActivePlayersMap = function() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;
    
    for (const [guildId, playerInfo] of this.activePlayers.entries()) {
        // Remove stale entries or if guild no longer exists
        if (!this.guilds.cache.has(guildId) || 
            (now - (playerInfo.startedAt || 0) > staleThreshold && !this.lavalink.getPlayer(guildId)?.playing)) {
            this.activePlayers.delete(guildId);
            cleanedCount++;
        }
    }
    
    // Enforce maximum size to prevent unbounded growth
    if (this.activePlayers.size > MAX_ACTIVE_PLAYERS) {
        const excess = this.activePlayers.size - MAX_ACTIVE_PLAYERS;
        const oldestEntries = Array.from(this.activePlayers.entries())
            .sort((a, b) => (a[1].startedAt || 0) - (b[1].startedAt || 0))
            .slice(0, excess);
        
        for (const [guildId] of oldestEntries) {
            this.activePlayers.delete(guildId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} stale active player entries`);
    }
};

// Start periodic cleanup
setInterval(() => {
    try {
        client.cleanupActivePlayersMap();
    } catch (error) {
        console.error('Error during active players cleanup:', error);
    }
}, CLEANUP_INTERVAL);

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

// Lavalink NodeManager events
client.lavalink.nodeManager.on('connect', (node) => {
    console.log(`Lavalink node "${node.options.id}" connected.`);
});

client.lavalink.nodeManager.on('error', (node, error) => {
    console.error(`Lavalink node "${node.options.id}" encountered an error:`, error);
});

client.lavalink.nodeManager.on('disconnect', (node, reason) => {
    console.log(`Lavalink node "${node.options.id}" disconnected. Reason: ${reason.reason || 'Unknown'}`);
});

// Lavalink events with enhanced error handling
client.lavalink.on("trackStart", (player, track) => {
    try {
        // Update player UI with error handling
        client.playerController.updatePlayer(player.guildId).catch(error => {
            console.error(`Error updating player UI for guild ${player.guildId}:`, error.message);
        });
        
        // Update presence
        client.activePlayers.set(player.guildId, {
            title: track.info?.title,
            startedAt: Date.now()
        });
        client.updatePresence();
    } catch (error) {
        console.error('Error in trackStart event:', error);
    }
});

client.lavalink.on("trackEnd", (player, track, reason) => {
    try {
        if (reason === "replaced") return; // Track was replaced, new one will start
        
        // Update player UI with delay and error handling
        setTimeout(() => {
            try {
                if (player.queue.current) {
                    client.playerController.updatePlayer(player.guildId).catch(error => {
                        console.error(`Error updating player UI after track end for guild ${player.guildId}:`, error.message);
                    });
                } else {
                    client.playerController.deletePlayer(player.guildId).catch(error => {
                        console.error(`Error deleting player UI for guild ${player.guildId}:`, error.message);
                    });
                    
                    // Remove from active players and update presence
                    client.activePlayers.delete(player.guildId);
                    client.updatePresence();
                }
            } catch (error) {
                console.error('Error in trackEnd delayed execution:', error);
            }
        }, 500);
    } catch (error) {
        console.error('Error in trackEnd event:', error);
    }
});

client.lavalink.on("queueEnd", (player) => {
    try {
        const guildId = player.guildId;
        const playerMessage = client.playerController.playerMessages.get(guildId);
        if (playerMessage) {
            const textChannel = client.channels.cache.get(playerMessage.channelId);
            if (textChannel) {
                textChannel.send(client.t('QUEUE_ENDED')).catch(error => {
                    console.error(`Error sending queue ended message for guild ${guildId}:`, error.message);
                });
            }
        }
        
        client.playerController.deletePlayer(guildId).catch(error => {
            console.error(`Error deleting player on queue end for guild ${guildId}:`, error.message);
        });
        
        // Remove from active players and update presence
        client.activePlayers.delete(guildId);
        client.updatePresence();
    } catch (error) {
        console.error('Error in queueEnd event:', error);
    }
});

// Additional Lavalink events for better error handling
client.lavalink.on("playerCreate", (player) => {
    console.log(`Player created for guild ${player.guildId}`);
});

client.lavalink.on("playerDestroy", (player, reason) => {
    try {
        console.log(`Player destroyed for guild ${player.guildId}, reason: ${reason || 'Unknown'}`);
        
        // Cleanup on player destruction
        client.playerController.deletePlayer(player.guildId).catch(error => {
            console.error(`Error cleaning up player UI for guild ${player.guildId}:`, error.message);
        });
        
        client.activePlayers.delete(player.guildId);
        client.updatePresence();
    } catch (error) {
        console.error('Error in playerDestroy event:', error);
    }
});

client.lavalink.on("trackError", (player, track, error) => {
    console.error(`Track error in guild ${player.guildId}:`, error);
    
    try {
        // Try to skip to next track on error
        if (player.queue.tracks.length > 0) {
            player.skip().catch(skipError => {
                console.error(`Error skipping track after error in guild ${player.guildId}:`, skipError);
            });
        }
    } catch (skipError) {
        console.error('Error handling track error:', skipError);
    }
});

client.lavalink.on("trackStuck", (player, track, thresholdMs) => {
    console.warn(`Track stuck in guild ${player.guildId} for ${thresholdMs}ms`);
    
    try {
        // Try to skip stuck track
        if (player.queue.tracks.length > 0) {
            player.skip().catch(skipError => {
                console.error(`Error skipping stuck track in guild ${player.guildId}:`, skipError);
            });
        }
    } catch (skipError) {
        console.error('Error handling stuck track:', skipError);
    }
});

loadCommands(client);
registerEvents(client);

client.login(process.env.TOKEN);
