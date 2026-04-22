const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses or resumes playback.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        logger.cmd(`/pause by ${interaction.user.tag} in #${interaction.channel.name} (Guild: ${interaction.guild.name})`);

        if (player.paused) {
            await player.resume();
            return interaction.reply({ 
                content: client.languageManager.get(client.defaultLanguage, 'RESUMED'), 
                flags: MessageFlags.Ephemeral
            });
        } else {
            await player.pause();
            return interaction.reply({ 
                content: client.languageManager.get(client.defaultLanguage, 'PAUSED'), 
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 