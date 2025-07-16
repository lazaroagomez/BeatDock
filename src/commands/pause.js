const { SlashCommandBuilder } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const { metrics } = require("../analytics/prometheusClient");
module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses or resumes playback.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        if (player.paused) {
            await player.resume();
            metrics.commandsExecuted.inc({ command: 'pause', status: 'resumed' });
            return interaction.reply({ 
                content: client.languageManager.get(client.defaultLanguage, 'RESUMED'), 
                ephemeral: true 
            });
        } else {
            metrics.commandsExecuted.inc({ command: 'pause', status: 'paused' });
            await player.pause();
            return interaction.reply({ 
                content: client.languageManager.get(client.defaultLanguage, 'PAUSED'), 
                ephemeral: true 
            });
        }
    },
}; 