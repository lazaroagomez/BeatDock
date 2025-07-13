const { SlashCommandBuilder } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const { metrics } = require("../analytics/prometheusClient");


module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops playback and clears the queue.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        await player.destroy();
        metrics.commandsExecuted.inc({ command: 'stop', status: 'success' });
        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'STOPPED_PLAYBACK'), 
            ephemeral: true 
        });
    },
}; 