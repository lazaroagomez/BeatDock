const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTrackSelectMenu } = require('./trackSelectMenu');

/**
 * Formats duration from milliseconds to readable format
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string (e.g., "3:45" or "1:23:45")
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

/**
 * Creates the search results embed with pagination
 *
 * @param {Object} client - Discord client instance
 * @param {Object} pageData - Page data from search session
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

    tracks.forEach((track, index) => {
        const globalIndex = pageData.startIndex + index;
        const duration = formatDuration(track.info?.duration || 0);

        embed.addFields({
            name: `${globalIndex + 1}. ${track.info?.title || 'Unknown Title'}`,
            value: `**${client.languageManager.get(lang, 'SEARCH_ARTIST')}:** ${track.info?.author || 'Unknown'}\n**${client.languageManager.get(lang, 'SEARCH_DURATION')}:** ${duration}`,
            inline: false
        });
    });

    return embed;
}

/**
 * Creates components for search results with dropdown and navigation
 *
 * @param {Object} client - Discord client instance
 * @param {Object} pageData - Page data from search session
 * @param {string} sessionId - Unique search session identifier
 * @returns {Array} Array of ActionRowBuilder components
 */
function createSearchComponents(client, pageData, sessionId) {
    const lang = client.defaultLanguage;
    const { hasNext, hasPrevious, tracks, startIndex } = pageData;

    const components = [];

    // Row 1: Track selection dropdown
    const selectMenu = createTrackSelectMenu(tracks, {
        customId: `search:select:${sessionId}`,
        placeholder: client.languageManager.get(lang, 'SEARCH_SELECT_PLACEHOLDER'),
        startIndex: startIndex,
    });
    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Navigation + Cancel
    const navRow = new ActionRowBuilder();

    if (hasPrevious) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`search:prev:${sessionId}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (hasNext) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`search:next:${sessionId}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`search:cancel:${sessionId}`)
            .setLabel(client.languageManager.get(lang, 'SEARCH_CANCEL'))
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    components.push(navRow);

    return components;
}

module.exports = {
    formatDuration,
    createSearchEmbed,
    createSearchComponents,
};
