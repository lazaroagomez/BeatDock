const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requirePlayer } = require('../utils/interactionHelpers');
const { buildFilterResponse } = require('../interactions/filterNavigation');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Apply audio effects and EQ presets to the music.'),
    async execute(interaction) {
        const { client } = interaction;

        const player = await requirePlayer(interaction);
        if (!player) return;

        logger.cmd(`/filter by ${interaction.user.tag} in #${interaction.channel.name} (Guild: ${interaction.guild.name})`);

        const response = buildFilterResponse(client, player, 1);
        return interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
    },
};
