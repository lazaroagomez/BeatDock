// Helper function to create a player
async function createPlayer(client, guildId, voiceChannelId, textChannelId) {
    const player = client.lavalink.createPlayer({
        guildId,
        voiceChannelId,
        textChannelId,
        selfDeaf: true,
        selfMute: false,
        volume: getValidVolume(process.env.DEFAULT_VOLUME, 80),
    });
    await player.connect();
    return player;
}

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const searchSessions = require('../utils/searchSessions');
const { isLavalinkAvailable, handleLavalinkError } = require('../utils/interactionHelpers');

// Validate and clamp volume to valid range (0-100)
function getValidVolume(envValue, defaultValue = 80) {
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed)) return defaultValue;
    return Math.max(0, Math.min(100, parsed)); // Clamp between 0-100
}

/**
 * Creates the search results embed with pagination
 *
 * Generates a Discord embed containing the current page of search results,
 * including track information, selection status, and pagination metadata.
 * The embed displays the search query, current page/total pages, total results,
 * and number of selected tracks.
 *
 * @param {Object} client - Discord client instance
 * @param {Object} pageData - Page data from search session containing tracks and pagination info
 * @param {string} query - Original search query
 * @returns {EmbedBuilder} Configured embed builder for search results
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
 *
 * Generates interactive button components for the search interface, including:
 * - Navigation buttons (previous/next page)
 * - Cancel button
 * - Track selection buttons for the current page
 *
 * Ensures compliance with Discord's 5-button per ActionRow limit and properly
 * disables navigation buttons when at page boundaries.
 *
 * @param {Object} client - Discord client instance
 * @param {Object} pageData - Page data from search session containing tracks and selection info
 * @param {string} sessionId - Unique search session identifier
 * @returns {Array} Array of ActionRowBuilder components for the search interface
 */
function createSearchButtons(client, pageData, sessionId) {
    const lang = client.defaultLanguage;
    const { currentPage, hasNext, hasPrevious, selectedCount, tracks } = pageData;

    // Navigation row - ensure maximum of 5 buttons per ActionRow
    const navRow = new ActionRowBuilder();
    
    // Add navigation buttons with proper validation
    if (hasPrevious) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_prev_${sessionId}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    if (hasNext) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_next_${sessionId}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    // Always include cancel button
    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`search_cancel_${sessionId}`)
            .setLabel(client.languageManager.get(lang, 'SEARCH_CANCEL'))
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    // Selection row - individual track buttons (max 5 per page)
    const selectionRow = new ActionRowBuilder();
    const MAX_BUTTONS_PER_ROW = 5;
    
    // Create a Set for O(1) lookup instead of using Array.includes()
    const selectedTrackSet = new Set(pageData.selectedTracks);
    
    tracks.forEach((track, index) => {
        const globalIndex = pageData.startIndex + index;
        const isSelected = selectedTrackSet.has(globalIndex);
        
        selectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_toggle_${sessionId}_${globalIndex}`)
                .setLabel(`${globalIndex + 1}`)
                .setEmoji(isSelected ? '✅' : '⬜')
                .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
        
        // Enforce Discord's limit of 5 buttons per ActionRow
        if (selectionRow.components.length >= MAX_BUTTONS_PER_ROW) {
            return;
        }
    });

    return [navRow, selectionRow];
}

/**
 * Formats duration from milliseconds to readable format
 *
 * Converts a duration in milliseconds to a human-readable string format.
 * Returns "MM:SS" for durations under an hour, and "HH:MM:SS" for longer durations.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string (e.g., "3:45" or "1:23:45")
 * @example
 * formatDuration(225000) // returns "3:45"
 * formatDuration(5025000) // returns "1:23:45"
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
    /**
     * Slash command data for the /search command
     *
     * Defines the command structure, name, description, and required options
     * for the search functionality. The command requires a search query string
     * with a maximum length of 200 characters.
     *
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for music and select tracks to add to the queue.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for music (max 200 characters).')
                .setRequired(true)),
    
    /**
     * Executes the search command
     *
     * Handles the /search command interaction by:
     * 1. Validating user input and voice channel membership
     * 2. Creating or retrieving a Lavalink player
     * 3. Searching for tracks using the provided query
     * 4. Creating a search session with results
     * 5. Displaying paginated search results with interactive buttons
     *
     * @param {CommandInteraction} interaction - Discord command interaction
     * @returns {Promise<void>} Resolves when command execution is complete
     * @throws {Error} If command execution fails
     */
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

        // Check if Lavalink is available
        if (!isLavalinkAvailable(client)) {
            return interaction.reply({ 
                content: client.languageManager.get(lang, 'LAVALINK_UNAVAILABLE'), 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        try {
            // Create or get player
            let player = client.lavalink.getPlayer(guild.id);
            if (!player) {
                player = await createPlayer(client, guild.id, voiceChannel.id, interaction.channel.id);
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
            await handleLavalinkError(interaction, error, client);
        }
    },
};