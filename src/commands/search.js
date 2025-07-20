const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const searchSessions = require('../utils/searchSessions');

// Validate and clamp volume to valid range (0-100)
function getValidVolume(envValue, defaultValue = 80) {
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed)) return defaultValue;
    return Math.max(0, Math.min(100, parsed)); // Clamp between 0-100
}

/**
 * Creates the search results embed with pagination
 * @param {Object} client - Discord client
 * @param {Object} pageData - Page data from search session
 * @param {string} query - Original search query
 * @returns {EmbedBuilder} Search results embed
 */
function createSearchEmbed(client, pageData, query) {
    const lang = client.defaultLanguage;
    const { tracks, currentPage, totalPages, totalTracks, selectedCount } = pageData;

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(client.languageManager.get(lang, 'SEARCH_RESULTS_TITLE'))
        .setDescription(client.languageManager.get(lang, 'SEARCH_QUERY', query))
        .setFooter({ 
            text: client.languageManager.get(lang, 'SEARCH_PAGINATION_FOOTER', currentPage, totalPages, totalTracks, selectedCount)
        })
        .setTimestamp();

    // Add track fields
    tracks.forEach((track, index) => {
        const globalIndex = pageData.startIndex + index;
        const isSelected = pageData.selectedTracks.includes(globalIndex);
        const selectionIcon = isSelected ? '✅' : '⬜';
        const duration = formatDuration(track.info?.duration || 0);
        
        embed.addFields({
            name: `${selectionIcon} ${globalIndex + 1}. ${track.info?.title || 'Unknown Title'}`,
            value: `**${client.languageManager.get(lang, 'SEARCH_ARTIST')}:** ${track.info?.author || 'Unknown'}\n**${client.languageManager.get(lang, 'SEARCH_DURATION')}:** ${duration}`,
            inline: false
        });
    });

    return embed;
}

/**
 * Creates action buttons for search navigation and selection
 * @param {Object} client - Discord client
 * @param {Object} pageData - Page data from search session
 * @param {string} sessionId - Search session ID
 * @returns {Array} Array of ActionRowBuilder components
 */
function createSearchButtons(client, pageData, sessionId) {
    const lang = client.defaultLanguage;
    const { currentPage, hasNext, hasPrevious, selectedCount, tracks } = pageData;

    // Navigation row
    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`search_prev_${sessionId}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasPrevious),
            new ButtonBuilder()
                .setCustomId(`search_next_${sessionId}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasNext),
            new ButtonBuilder()
                .setCustomId(`search_cancel_${sessionId}`)
                .setLabel(client.languageManager.get(lang, 'SEARCH_CANCEL'))
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

    // Selection row - individual track buttons (max 5 per page)
    const selectionRow = new ActionRowBuilder();
    tracks.forEach((track, index) => {
        const globalIndex = pageData.startIndex + index;
        const isSelected = pageData.selectedTracks.includes(globalIndex);
        
        selectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_toggle_${sessionId}_${globalIndex}`)
                .setLabel(`${globalIndex + 1}`)
                .setEmoji(isSelected ? '✅' : '⬜')
                .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
    });

    return [navRow, selectionRow];
}

/**
 * Formats duration from milliseconds to readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for music and select tracks to add to the queue.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for music (max 200 characters).')
                .setRequired(true)),
    async execute(interaction) {
        const { client, guild, member, options } = interaction;
        const query = options.getString('query');
        const voiceChannel = member.voice.channel;
        const lang = client.defaultLanguage;

        // Input validation
        if (!query || query.trim().length === 0) {
            return interaction.reply({ 
                content: client.languageManager.get(lang, 'SEARCH_EMPTY_QUERY'), 
                ephemeral: true 
            });
        }

        if (query.length > 200) {
            return interaction.reply({ 
                content: client.languageManager.get(lang, 'SEARCH_QUERY_TOO_LONG'), 
                ephemeral: true 
            });
        }

        if (!voiceChannel) {
            return interaction.reply({ 
                content: client.languageManager.get(lang, 'NOT_IN_VOICE'), 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        try {
            // Create or get player
            let player = client.lavalink.getPlayer(guild.id);
            if (!player) {
                player = client.lavalink.createPlayer({
                    guildId: guild.id,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channel.id,
                    selfDeaf: true,
                    selfMute: false,
                    volume: getValidVolume(process.env.DEFAULT_VOLUME, 80),
                });
                player.connect();
            } else if (player.voiceChannelId !== voiceChannel.id) {
                return interaction.editReply({ 
                    content: client.languageManager.get(lang, 'ERROR_SAME_VOICE_CHANNEL')
                });
            }

            // Search for tracks
            const searchResult = await player.search({
                query: query.trim(),
            }, interaction.user);

            if (!searchResult || !searchResult.tracks.length) {
                return interaction.editReply({ 
                    content: client.languageManager.get(lang, 'NO_RESULTS') 
                });
            }

            // Create search session
            const sessionId = searchSessions.createSession(
                interaction.user.id,
                guild.id,
                searchResult.tracks,
                query.trim()
            );

            // Get initial page data
            const pageData = searchSessions.getCurrentPageData(sessionId);
            if (!pageData) {
                return interaction.editReply({ 
                    content: client.languageManager.get(lang, 'SEARCH_SESSION_ERROR') 
                });
            }

            // Create and send search results
            const embed = createSearchEmbed(client, pageData, query.trim());
            const components = createSearchButtons(client, pageData, sessionId);

            await interaction.editReply({ 
                embeds: [embed], 
                components 
            });

        } catch (error) {
            console.error('Error in search command:', error);
            await interaction.editReply({ 
                content: client.languageManager.get(lang, 'SEARCH_ERROR') 
            });
        }
    },
};