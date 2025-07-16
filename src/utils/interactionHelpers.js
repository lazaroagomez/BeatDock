const requirePlayer = async (interaction, { requireQueue = false } = {}) => {
    const { client, guild } = interaction;
    console.log(`Interaction from guild: ${guild.id}, user: ${interaction.user.id}`);
    const lang = client.defaultLanguage;

    const player = client.lavalink.getPlayer(guild.id);
    if (!player) {
        await interaction.reply({
            content: client.languageManager.get(lang, 'NOTHING_PLAYING'),
            ephemeral: true,
        }).catch(() => {});
        return null;
    }

    if (requireQueue && player.queue.tracks.length === 0) {
        await interaction.reply({
            content: client.languageManager.get(lang, 'QUEUE_EMPTY'),
            ephemeral: true,
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
            ephemeral: true,
        }).catch(() => {});
        return false;
    }
    return true;
};

module.exports = {
    requirePlayer,
    requireSameVoice,
}; 