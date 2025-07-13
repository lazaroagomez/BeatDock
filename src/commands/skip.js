const { SlashCommandBuilder } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const { metrics } = require("../analytics/prometheusClient");
module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        if (player.queue.tracks.length === 0) {
            return interaction.reply({ content: client.languageManager.get(lang, 'QUEUE_EMPTY'), ephemeral: true });
        }

        await player.skip();
        metrics.commandsExecuted.inc({ command: 'skip', status: 'success' });   
        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'SONG_SKIPPED'), 
            ephemeral: true 
        });
    },
}; 