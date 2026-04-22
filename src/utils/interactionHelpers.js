const { MessageFlags } = require('discord.js');
const logger = require('./logger');

// Check if Lavalink is available
const isLavalinkAvailable = (client) => {
    return client.lavalinkConnectionManager.isAvailable();
};

// Handle Lavalink connection errors consistently
const handleLavalinkError = async (interaction, error, client) => {
    const lang = client.defaultLanguage;
    const msg = error?.message || '';
    const key = error?.name === 'TimeoutError' || /aborted due to timeout/i.test(msg)
        ? 'LAVALINK_TIMEOUT'
        : /No available Node|Unable to connect/.test(msg)
            ? 'LAVALINK_UNAVAILABLE'
            : 'GENERIC_ERROR';
    const content = client.languageManager.get(lang, key);

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
    } catch (replyError) {
        if (replyError.code === 10062) {
            logger.warn('Interaction expired while handling Lavalink error');
            return;
        }
        logger.error('Failed to send error response:', replyError);
    }
};

const requirePlayer = async (interaction, { requireQueue = false } = {}) => {
    const { client, guild } = interaction;
    const lang = client.defaultLanguage;

    // Check if Lavalink is available first
    if (!isLavalinkAvailable(client)) {
        await interaction.reply({
            content: client.languageManager.get(lang, 'LAVALINK_UNAVAILABLE'),
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return null;
    }

    const player = client.lavalink.getPlayer(guild.id);
    if (!player) {
        await interaction.reply({
            content: client.languageManager.get(lang, 'NOTHING_PLAYING'),
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return null;
    }

    if (requireQueue && player.queue.tracks.length === 0) {
        await interaction.reply({
            content: client.languageManager.get(lang, 'QUEUE_EMPTY'),
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return null;
    }

    return player;
};

/**
 * Ensures the member executing the interaction is in the same voice channel as the player.
 * Returns true if validation passes, otherwise replies with an error and returns false.
 */
const requireSameVoice = async (interaction, player) => {
    const { member, client } = interaction;
    const lang = client.defaultLanguage;

    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId) {
        await interaction.reply({
            content: client.languageManager.get(lang, 'NOT_IN_VOICE'),
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return false;
    }
    return true;
};

module.exports = {
    requirePlayer,
    requireSameVoice,
    isLavalinkAvailable,
    handleLavalinkError,
};