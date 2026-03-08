require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const LanguageManager = require('./LanguageManager');
const PlayerController = require('./utils/PlayerController');
const LavalinkConnectionManager = require('./utils/LavalinkConnectionManager');
const PublicNodeProvider = require('./utils/PublicNodeProvider');
const searchSessions = require('./utils/searchSessions');
const loadCommands = require('./handlers/commandHandler');
const registerEvents = require('./handlers/eventHandler');

function isLocalLavalinkConfigured() {
    const host = process.env.LAVALINK_HOST;
    const port = process.env.LAVALINK_PORT;
    const password = process.env.LAVALINK_PASSWORD;
    return Boolean(host && host.trim() && port && port.trim() && password && password.trim());
}

async function getInitialNodes() {
    if (isLocalLavalinkConfigured()) {
        console.log('Using local Lavalink server.');
        return {
            mode: 'local',
            nodes: [{
                host: process.env.LAVALINK_HOST,
                port: parseInt(process.env.LAVALINK_PORT),
                authorization: process.env.LAVALINK_PASSWORD,
                id: 'main-node',
                reconnectTimeout: 10000,
                reconnectTries: 3,
            }],
            provider: null,
        };
    }

    console.log('No local Lavalink configured. Fetching public Lavalink servers...');
    const provider = new PublicNodeProvider();
    const success = await provider.fetchNodes();

    if (!success || !provider.hasNodes()) {
        throw new Error('Failed to fetch public Lavalink nodes. Cannot start without a Lavalink server.');
    }

    provider.startAutoRefresh();
    const firstNode = provider.getNextNode();
    console.log(`Selected public node: ${firstNode.secure ? 'wss' : 'ws'}://${firstNode.host}:${firstNode.port}`);

    return {
        mode: 'public',
        nodes: [firstNode],
        provider,
    };
}

async function bootstrap() {
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

    // Determine Lavalink mode and get initial node config
    const { mode, nodes, provider } = await getInitialNodes();
    client.lavalinkMode = mode;
    client.publicNodeProvider = provider;

    client.lavalink = new LavalinkManager({
        nodes,
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

        // Cleanup public node provider
        if (client.publicNodeProvider) {
            client.publicNodeProvider.destroy();
        }

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

    await client.login(process.env.TOKEN);
}

bootstrap().catch(err => {
    console.error('Failed to start bot:', err);
    process.exit(1);
});
