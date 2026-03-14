const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay mode to automatically play related songs.'),
    async execute(interaction) {
        const { client } = interaction;
        const { requirePlayer } = require('../utils/interactionHelpers');

        const player = await requirePlayer(interaction);
        if (!player) return;

        const guildId = interaction.guild.id;
        const newState = !client.autoplayEnabled.get(guildId);
        client.autoplayEnabled.set(guildId, newState);

        // When enabling autoplay, reset loop mode (DJ mode takes over)
        if (newState && player.repeatMode !== 'off') {
            player.setRepeatMode('off');
        }

        setTimeout(() => client.playerController.updatePlayer(guildId), 100);

        return interaction.reply({
            content: client.t(newState ? 'AUTOPLAY_ENABLED' : 'AUTOPLAY_DISABLED'),
            ephemeral: true,
        });
    },
};
