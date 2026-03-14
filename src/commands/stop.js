const { SlashCommandBuilder } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops playback and clears the queue.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        client.autoplayEnabled.delete(interaction.guild.id);
        await player.destroy();
        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'STOPPED_PLAYBACK'), 
            ephemeral: true 
        });
    },
}; 