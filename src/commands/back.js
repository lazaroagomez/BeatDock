const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const { playPrevious } = require('../utils/PlayerActions');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('back')
        .setDescription('Goes back to the previous song.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        logger.cmd(`/back by ${interaction.user.tag} in #${interaction.channel.name} (Guild: ${interaction.guild.name})`);

        const track = await playPrevious(player);

        if (!track) {
            return interaction.reply({ 
                content: client.languageManager.get(client.defaultLanguage, 'NO_PREVIOUS_SONG'), 
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply({ 
            content: client.languageManager.get(client.defaultLanguage, 'PLAYING_PREVIOUS', track.info?.title || 'Unknown'), 
            flags: MessageFlags.Ephemeral
        });
    },
}; 