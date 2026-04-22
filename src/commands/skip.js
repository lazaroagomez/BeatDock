const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song.'),
    async execute(interaction) {
        const { client } = interaction;
        const lang = client.defaultLanguage;

        const player = await requirePlayer(interaction);
        if (!player) return;

        logger.cmd(`/skip by ${interaction.user.tag} in #${interaction.channel.name} (Guild: ${interaction.guild.name})`);

        const autoplayOn = client.autoplayEnabled.get(interaction.guild.id) || false;
        if (player.queue.tracks.length === 0 && !autoplayOn) {
            return interaction.reply({ content: client.languageManager.get(lang, 'QUEUE_EMPTY'), flags: MessageFlags.Ephemeral });
        }

        if (player.queue.tracks.length === 0 && autoplayOn) {
            await player.skip(0, false);
        } else {
            await player.skip();
        }

        return interaction.reply({
            content: client.languageManager.get(lang, 'SONG_SKIPPED'),
            flags: MessageFlags.Ephemeral
        });
    },
}; 