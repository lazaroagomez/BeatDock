const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Shows information about the currently playing song.'),
    async execute(interaction) {
        const { client } = interaction;
        const { requirePlayer } = require('../utils/interactionHelpers');

        const player = await requirePlayer(interaction);
        if (!player) return;

        logger.cmd(`/nowplaying by ${interaction.user.tag} in #${interaction.channel.name} (Guild: ${interaction.guild.name})`);

        if (!player.playing || !player.queue.current) {
            return interaction.reply({ 
                content: client.languageManager.get(client.defaultLanguage, 'NOTHING_PLAYING'), 
                flags: MessageFlags.Ephemeral
            });
        }

        const track = player.queue.current;

        const embed = client.playerController.createPlayerEmbed(player, track);

        // Add loop status to nowplaying
        if (player.repeatMode && player.repeatMode !== 'off') {
            const loopIcon = player.repeatMode === 'track' ? '🔂' : '🔁';
            const loopText = player.repeatMode === 'track' 
                ? client.languageManager.get(client.defaultLanguage, 'LOOP_STATUS_TRACK')
                : client.languageManager.get(client.defaultLanguage, 'LOOP_STATUS_QUEUE');
            
            embed.addFields({
                name: client.languageManager.get(client.defaultLanguage, 'LOOP_STATUS'),
                value: `${loopIcon} ${loopText}`,
                inline: true
            });
        }

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
    },
}; 