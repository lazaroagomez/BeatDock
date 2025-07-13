const { SlashCommandBuilder } = require('discord.js');
const {metrics} = require('../analytics/prometheusClient')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clears the queue.'),
    async execute(interaction) {
        const { client } = interaction;
        const { requirePlayer } = require('../utils/interactionHelpers');
        const { clearQueue } = require('../utils/PlayerActions');

        const player = await requirePlayer(interaction, { requireQueue: true });
        if (!player) return;

        clearQueue(player);
        metrics.commandsExecuted.inc({ command: 'clear', status: 'success' });
        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'QUEUE_CLEARED'), 
            ephemeral: true 
        });
    },
}; 