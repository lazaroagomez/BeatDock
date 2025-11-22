const { SlashCommandBuilder } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song.'),
    async execute(interaction) {
        const { client } = interaction;
        const lang = client.defaultLanguage;

        const player = await requirePlayer(interaction);
        if (!player) return;

        if (player.queue.tracks.length === 0) {
            return interaction.reply({ content: client.languageManager.get(lang, 'QUEUE_EMPTY'), ephemeral: true });
        }

        await player.skip();
        return interaction.reply({
            content: client.languageManager.get(lang, 'SONG_SKIPPED'),
            ephemeral: true
        });
    },
}; 