const { SlashCommandBuilder } = require('discord.js');
const { metrics } = require("../analytics/prometheusClient");


// Validate and clamp volume to valid range (0-100)
function getValidVolume(envValue, defaultValue = 80) {
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed)) return defaultValue;
    return Math.max(0, Math.min(100, parsed)); // Clamp between 0-100
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from YouTube.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song to play (URL or search query).')
                .setRequired(true)),
    async execute(interaction) {
        const { client, guild, member, options } = interaction;
        const query = options.getString('query');
        const voiceChannel = member.voice.channel;
        const lang = client.defaultLanguage;

        if (!voiceChannel) {
            metrics.commandsExecuted.inc({ command: 'play', status: 'error-no-voice' }); 
            return interaction.reply({ content: client.languageManager.get(lang, 'NOT_IN_VOICE'), ephemeral: true });
        }

        await interaction.deferReply();

        const player = client.lavalink.createPlayer({
            guildId: guild.id,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channel.id,
            selfDeaf: true,
            selfMute: false,
            volume: getValidVolume(process.env.DEFAULT_VOLUME, 80),
        });

        if(player.voiceChannelId !== voiceChannel.id) {
            metrics.commandsExecuted.inc({ command: 'play', status: 'error-different-voice' });
            return interaction.editReply({ 
                content: client.languageManager.get(client.defaultLanguage, 'ERROR_SAME_VOICE_CHANNEL'), 
                ephemeral: true 
            });
        }
        
        player.connect();
        metrics.voiceChannelConnections.inc({ guild_id: guild.id });
        const searchStart = Date.now();
        const res = await player.search({
            query: query,
        }, interaction.user);
        const searchDuration = (Date.now() - searchStart) / 1000;
            metrics.searchDuration.observe({ guild_id: guild.id }, searchDuration);
        if (!res || !res.tracks.length) {
              metrics.commandsExecuted.inc({ 
                    command: 'play', 
                    status: 'no_results' 
                });
            return interaction.editReply({ content: client.languageManager.get(lang, 'NO_RESULTS') });
        }

        player.queue.add(res.loadType === "playlist" ? res.tracks : res.tracks[0]);

        if (!player.playing) {
            player.play();
        }
        metrics.activePlayers.set(client.lavalink.players.size);
        let replyContent;
        if (res.loadType === "playlist") {
            metrics.playlistsAdded.inc({ guild_id: guild.id });
            metrics.songsPlayed.inc({ guild_id: guild.id, source: 'playlist' }, 1);
            replyContent = client.languageManager.get(lang, 'PLAYLIST_ADDED', res.playlist?.title);
        } else {
            const trackTitle = res.tracks[0].info?.title || client.languageManager.get(lang, 'UNKNOWN_TITLE');
            metrics.songsPlayed.inc({ guild_id: guild.id, source: 'single' });
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
        metrics.commandsExecuted.inc({ 
                command: 'play', 
                status: 'success' 
            })
    },

   
};
