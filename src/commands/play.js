const { SlashCommandBuilder } = require('discord.js');
const { isLavalinkAvailable, handleLavalinkError } = require('../utils/interactionHelpers');
const { getValidVolume } = require('../utils/volumeValidator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from YouTube.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song to play (URL or search query).')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('next')
                .setDescription('Add the song to play next in the queue.')
                .setRequired(false)),
    async execute(interaction) {
        const { client, guild, member, options } = interaction;
        const query = options.getString('query');
        const playNext = options.getBoolean('next') || false;
        const voiceChannel = member.voice.channel;
        const lang = client.defaultLanguage;

        if (!voiceChannel) {
            return interaction.reply({ content: client.languageManager.get(lang, 'NOT_IN_VOICE'), ephemeral: true });
        }

        // Check if Lavalink is available
        if (!isLavalinkAvailable(client)) {
            return interaction.reply({ 
                content: client.languageManager.get(lang, 'LAVALINK_UNAVAILABLE'), 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        try {
            let player = client.lavalink.getPlayer(guild.id);

            if (!player) {
                // Create a new player if one doesn't exist
                player = client.lavalink.createPlayer({
                    guildId: guild.id,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channel.id,
                    selfDeaf: true,
                    selfMute: false,
                    volume: getValidVolume(process.env.DEFAULT_VOLUME, 80),
                });
            }

            // Check if the bot is in a different voice channel
            if (player.voiceChannelId && player.voiceChannelId !== voiceChannel.id) {
                return interaction.editReply({
                    content: client.languageManager.get(lang, 'ERROR_SAME_VOICE_CHANNEL'),
                    ephemeral: true,
                });
            }
            
            // Connect if not connected
            if (!player.connected) {
                player.connect();
            }
            
            const res = await player.search({
                query: query,
            }, interaction.user);

            if (!res || !res.tracks.length) {
                return interaction.editReply({ content: client.languageManager.get(lang, 'NO_RESULTS') });
            }

            player.queue.add(
                res.loadType === "playlist" ? res.tracks : res.tracks[0],
                playNext ? 0 : undefined
            );

            if (!player.playing) {
                player.play();
            }

            let replyContent;
            if (res.loadType === "playlist") {
                replyContent = client.languageManager.get(lang, 'PLAYLIST_ADDED', res.playlist?.title);
            } else {
                const trackTitle = res.tracks[0].info?.title || client.languageManager.get(lang, 'UNKNOWN_TITLE');
                replyContent = client.languageManager.get(lang, 'SONG_ADDED', trackTitle);
            }

            await interaction.editReply({ content: replyContent });

            // Send or update the player controller
            const existingMessageId = client.playerController.playerMessages.get(guild.id);
            if (existingMessageId) {
                await client.playerController.updatePlayer(guild.id);
            } else {
                await client.playerController.sendPlayer(interaction.channel, player);
            }
            
        } catch (error) {
            console.error('Error in play command:', error);
            await handleLavalinkError(interaction, error, client);
        }
    },
};
