const { SlashCommandBuilder } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const { metrics } = require("../analytics/prometheusClient");


module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Adjusts the playback volume.')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),
    async execute(interaction) {
        const { client, options } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        const volume = options.getInteger('level');

        // Set the volume
        player.setVolume(volume);
        metrics.commandsExecuted.inc({ 
            command: 'volume', 
            status: 'success' 
        });
        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'VOLUME_SET', volume), 
            ephemeral: true 
        });
    },
}; 