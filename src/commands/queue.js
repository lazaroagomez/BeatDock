const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Displays the song queue.'),
    async execute(interaction) {
        const { client } = interaction;
        const { requirePlayer } = require('../utils/interactionHelpers');
        const { createPaginatedQueueResponse } = require('../utils/PlayerActions');

        const player = await requirePlayer(interaction, { requireQueue: true });
        if (!player) return;

        const queueResponse = createPaginatedQueueResponse(client, player, 1);
        return interaction.reply(queueResponse);
    },
}; 