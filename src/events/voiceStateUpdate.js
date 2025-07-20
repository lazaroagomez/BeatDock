const { Events } = require('discord.js');

// Keep track of disconnect timers per guild with memory leak prevention
const emptyChannelTimeouts = new Map();
const MAX_TIMEOUT_ENTRIES = 500; // Prevent unbounded growth
const TIMEOUT_CLEANUP_INTERVAL = 300000; // 5 minutes

// Periodic cleanup for timeout map
setInterval(() => {
    try {
        if (emptyChannelTimeouts.size > MAX_TIMEOUT_ENTRIES) {
            // Clear oldest entries if map grows too large
            const entriesToRemove = emptyChannelTimeouts.size - MAX_TIMEOUT_ENTRIES;
            const oldestEntries = Array.from(emptyChannelTimeouts.keys()).slice(0, entriesToRemove);
            
            for (const guildId of oldestEntries) {
                const timeout = emptyChannelTimeouts.get(guildId);
                if (timeout) {
                    clearTimeout(timeout);
                }
                emptyChannelTimeouts.delete(guildId);
            }
            
            console.log(`Cleaned up ${entriesToRemove} old timeout entries`);
        }
    } catch (error) {
        console.error('Error during timeout cleanup:', error);
    }
}, TIMEOUT_CLEANUP_INTERVAL);

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const client = oldState.client;
        const botId = client.user.id;

        // --- 1. Handle the bot itself being disconnected/moved ---------------------------------
        if (oldState.id === botId) {
            // Bot left voice completely
            if (oldState.channelId && !newState.channelId) {
                const guildId = oldState.guild.id;

                // Clean up Lavalink player and controller message
                const player = client.lavalink.getPlayer(guildId);
                if (player) player.destroy();
                client.playerController.deletePlayer(guildId);
                
                // Update presence
                client.activePlayers.delete(guildId);
                client.updatePresence();

                // Clear any pending empty-channel disconnect timers
                if (emptyChannelTimeouts.has(guildId)) {
                    clearTimeout(emptyChannelTimeouts.get(guildId));
                    emptyChannelTimeouts.delete(guildId);
                }
            }
            return; // No further processing needed when the bot moved
        }

        // --- 2. Handle human users joining/leaving the bot's channel -----------------------------

        const botMember = oldState.guild.members.me;
        if (!botMember || !botMember.voice.channel) return; // Bot not in any channel

        const botChannel = botMember.voice.channel;

        // Only react if the update concerns the channel the bot is in
        if (
            oldState.channelId !== botChannel.id &&
            newState.channelId !== botChannel.id
        ) {
            return;
        }

        const guildId = botChannel.guild.id;

        // Count non-bot members in the channel
        const nonBotMembers = botChannel.members.filter((m) => !m.user.bot);

        const timeoutMs = parseInt(process.env.EMPTY_CHANNEL_DESTROY_MS || "60000", 10);

        if (nonBotMembers.size === 0) {
            // Channel became empty – start a timer if not already running
            if (!emptyChannelTimeouts.has(guildId)) {
                const timeout = setTimeout(async () => {
                    emptyChannelTimeouts.delete(guildId);

                    // Send leave message (if we can still find the text channel)
                    const playerMessage = client.playerController.playerMessages.get(guildId);
                    if (playerMessage) {
                        const textChannel = client.channels.cache.get(playerMessage.channelId);
                        if (textChannel) {
                            await textChannel.send(client.t('LEFT_EMPTY'));
                        }
                    }

                    // Destroy player and cleanup
                    const player = client.lavalink.getPlayer(guildId);
                    if (player) player.destroy();
                    client.playerController.deletePlayer(guildId);
                    
                    // Update presence
                    client.activePlayers.delete(guildId);
                    client.updatePresence();
                }, timeoutMs);

                emptyChannelTimeouts.set(guildId, timeout);
            }
        } else {
            // Someone (re)joined – clear the pending disconnect if present
            if (emptyChannelTimeouts.has(guildId)) {
                clearTimeout(emptyChannelTimeouts.get(guildId));
                emptyChannelTimeouts.delete(guildId);
            }
        }
    },
};
