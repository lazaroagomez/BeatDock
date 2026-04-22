const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');

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

        logger.cmd(`/clear by ${interaction.user.tag} in #${interaction.channel.name} (Guild: ${interaction.guild.name})`);

        if (client.autoplayEnabled.get(interaction.guild.id)) {
            return interaction.reply({
                content: client.languageManager.get(client.defaultLanguage, 'AUTOPLAY_BLOCKS_ACTION'),
                flags: MessageFlags.Ephemeral,
            });
        }

        clearQueue(player);

        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'QUEUE_CLEARED'),
            flags: MessageFlags.Ephemeral
        });
    },
}; 