const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class PlayerController {
    constructor(client) {
        this.client = client;
        this.playerMessages = new Map(); // Guild ID -> Message ID
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
                    .setCustomId('player:back')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player:playpause')
                    .setEmoji(isPaused ? '▶️' : '⏸️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('player:skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player:stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player:shuffle')
                    .setEmoji('🔀')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player:loop')
                    .setEmoji(loopIcon)
                    .setStyle(player.repeatMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player:queue')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player:clear')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Secondary)
            );

        return [row1, row2];
    }

    async sendPlayer(channel, player) {
        const track = player.queue.current;
        if (!track) return;

        const embed = this.createPlayerEmbed(player, track);
        const components = this.createPlayerButtons(player);

        const message = await channel.send({ embeds: [embed], components });
        this.playerMessages.set(player.guildId, {
            messageId: message.id,
            channelId: channel.id,
        });
        return message;
    }

    async updatePlayer(guildId) {
        const player = this.client.lavalink.getPlayer(guildId);
        if (!player || !player.queue.current) return;

        const playerMessage = this.playerMessages.get(guildId);
        if (!playerMessage) return;

        const channel = this.client.channels.cache.get(playerMessage.channelId);
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(playerMessage.messageId);
            const embed = this.createPlayerEmbed(player, player.queue.current);
            const components = this.createPlayerButtons(player);
            
            await message.edit({ embeds: [embed], components });
        } catch (error) {
            console.error('Error updating player:', error);
            this.playerMessages.delete(guildId);
        }
    }

    async deletePlayer(guildId) {
        const playerMessage = this.playerMessages.get(guildId);
        if (!playerMessage) return;

        const channel = this.client.channels.cache.get(playerMessage.channelId);
        if (channel) {
            try {
                const message = await channel.messages.fetch(playerMessage.messageId);
                await message.delete();
            } catch (error) {
                // We can ignore errors here, as the message might have been deleted manually.
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