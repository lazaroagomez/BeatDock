const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class PlayerController {
    constructor(client) {
        this.client = client;
        this.playerMessages = new Map(); // Guild ID -> Message ID
        this.MAX_PLAYER_MESSAGES = 1000; // Prevent unbounded growth
        this.CLEANUP_INTERVAL = 180000; // 3 minutes
        
        // Start periodic cleanup
        setInterval(() => {
            this.cleanupPlayerMessages();
        }, this.CLEANUP_INTERVAL);
    }

    // Cleanup stale player message references
    cleanupPlayerMessages() {
        try {
            let cleanedCount = 0;
            
            for (const [guildId, messageInfo] of this.playerMessages.entries()) {
                // Remove if guild no longer exists or channel no longer exists
                if (!this.client.guilds.cache.has(guildId) || 
                    !this.client.channels.cache.has(messageInfo.channelId)) {
                    this.playerMessages.delete(guildId);
                    cleanedCount++;
                }
            }
            
            // Enforce maximum size
            if (this.playerMessages.size > this.MAX_PLAYER_MESSAGES) {
                const excess = this.playerMessages.size - this.MAX_PLAYER_MESSAGES;
                const oldestEntries = Array.from(this.playerMessages.keys()).slice(0, excess);
                
                for (const guildId of oldestEntries) {
                    this.playerMessages.delete(guildId);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} stale player message references`);
            }
        } catch (error) {
            console.error('Error during player message cleanup:', error);
        }
    }

    createPlayerEmbed(player, track) {
        const lang = this.client.defaultLanguage;
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(this.client.languageManager.get(lang, 'PLAYER_TITLE'))
            .setDescription(`**${this.client.languageManager.get(lang, 'PLAYER_NOW_PLAYING')}:**\n[${track.info?.title || 'Unknown'}](${track.info?.uri || '#'})`)
            .setThumbnail(track.info?.artworkUrl || null)
            .addFields(
                { name: this.client.languageManager.get(lang, 'PLAYER_ARTIST'), value: track.info?.author || 'Unknown', inline: true },
                { name: this.client.languageManager.get(lang, 'PLAYER_DURATION'), value: this.formatDuration(track.info?.duration || 0), inline: true },
                { name: this.client.languageManager.get(lang, 'PLAYER_QUEUE_COUNT'), value: this.client.languageManager.get(lang, 'PLAYER_SONGS_COUNT', player.queue.tracks.length), inline: true }
            )
            .setFooter({ text: this.client.languageManager.get(lang, 'PLAYER_VOLUME', player.volume) })
            .setTimestamp();

        // Add loop status to the embed
        if (player.repeatMode && player.repeatMode !== 'off') {
            const loopIcon = player.repeatMode === 'track' ? '🔂' : '🔁';
            const loopText = player.repeatMode === 'track' 
                ? this.client.languageManager.get(lang, 'LOOP_STATUS_TRACK')
                : this.client.languageManager.get(lang, 'LOOP_STATUS_QUEUE');
            embed.setFooter({ 
                text: `${this.client.languageManager.get(lang, 'PLAYER_VOLUME', player.volume)} | ${loopIcon} ${loopText}` 
            });
        }

        return embed;
    }

    createPlayerButtons(player) {
        const isPaused = player.paused;
        const loopIcon = player.repeatMode === 'track' ? '🔂' : player.repeatMode === 'queue' ? '🔁' : '➡️';
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_back')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_playpause')
                    .setEmoji(isPaused ? '▶️' : '⏸️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('player_skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_shuffle')
                    .setEmoji('🔀')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_loop')
                    .setEmoji(loopIcon)
                    .setStyle(player.repeatMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_queue')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_clear')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Secondary)
            );

        return [row1, row2];
    }

    // Timeout wrapper for Discord API operations
    async withTimeout(promise, timeoutMs = 5000, operation = 'Discord operation') {
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
        );
        
        try {
            return await Promise.race([promise, timeout]);
        } catch (error) {
            console.error(`Error in ${operation}:`, error.message);
            throw error;
        }
    }

    async sendPlayer(channel, player) {
        const track = player.queue.current;
        if (!track) return;

        try {
            const embed = this.createPlayerEmbed(player, track);
            const components = this.createPlayerButtons(player);

            const message = await this.withTimeout(
                channel.send({ embeds: [embed], components }),
                8000,
                'sendPlayer'
            );

            this.playerMessages.set(player.guildId, {
                messageId: message.id,
                channelId: channel.id,
                createdAt: Date.now()
            });
            return message;
        } catch (error) {
            console.error(`Failed to send player message for guild ${player.guildId}:`, error.message);
            return null;
        }
    }

    async updatePlayer(guildId) {
        const player = this.client.lavalink.getPlayer(guildId);
        if (!player || !player.queue.current) return;

        const playerMessage = this.playerMessages.get(guildId);
        if (!playerMessage) return;

        const channel = this.client.channels.cache.get(playerMessage.channelId);
        if (!channel) {
            // Channel no longer exists, cleanup
            this.playerMessages.delete(guildId);
            return;
        }

        try {
            const message = await this.withTimeout(
                channel.messages.fetch(playerMessage.messageId),
                5000,
                'fetchPlayerMessage'
            );

            const embed = this.createPlayerEmbed(player, player.queue.current);
            const components = this.createPlayerButtons(player);
            
            await this.withTimeout(
                message.edit({ embeds: [embed], components }),
                5000,
                'updatePlayerMessage'
            );
        } catch (error) {
            console.error(`Error updating player for guild ${guildId}:`, error.message);
            // If update fails, remove the stale reference
            this.playerMessages.delete(guildId);
        }
    }

    async deletePlayer(guildId) {
        const playerMessage = this.playerMessages.get(guildId);
        if (!playerMessage) return;

        const channel = this.client.channels.cache.get(playerMessage.channelId);
        if (channel) {
            try {
                const message = await this.withTimeout(
                    channel.messages.fetch(playerMessage.messageId),
                    3000,
                    'fetchPlayerMessageForDeletion'
                );
                
                await this.withTimeout(
                    message.delete(),
                    3000,
                    'deletePlayerMessage'
                );
            } catch (error) {
                // Silent fail - message might have been deleted manually or channel removed
                console.log(`Could not delete player message for guild ${guildId}: ${error.message}`);
            }
        }

        this.playerMessages.delete(guildId);
    }

    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}

module.exports = PlayerController;
