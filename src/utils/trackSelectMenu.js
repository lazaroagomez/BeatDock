const { StringSelectMenuBuilder } = require('discord.js');

/**
 * Truncates text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 30) {
    if (!text) return 'Unknown';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
}

/**
 * Creates a track selection dropdown menu
 * Shared utility used by both /search and /queue commands
 *
 * @param {Array} tracks - Array of track objects from Lavalink
 * @param {Object} options - Configuration options
 * @param {string} options.customId - Custom ID for the select menu
 * @param {string} options.placeholder - Placeholder text
 * @param {number} options.startIndex - Starting index for track numbering
 * @param {number} options.maxOptions - Maximum options (Discord limit: 25)
 * @param {Function} options.valueFormatter - Optional custom value formatter (receives globalIndex)
 * @returns {StringSelectMenuBuilder} Configured select menu
 */
function createTrackSelectMenu(tracks, options = {}) {
    const {
        customId = 'track:select',
        placeholder = 'Select a track...',
        startIndex = 0,
        maxOptions = 25,
        valueFormatter = (globalIndex) => `${globalIndex}`,
    } = options;

    const selectOptions = tracks.slice(0, maxOptions).map((track, index) => {
        const globalIndex = startIndex + index;
        const displayNum = globalIndex + 1;
        const title = truncateText(track.info?.title || 'Unknown', 50);
        const artist = truncateText(track.info?.author || 'Unknown', 50);

        return {
            label: `${displayNum}. ${title}`,
            description: artist.substring(0, 100),
            value: valueFormatter(globalIndex),
            emoji: '▶️'
        };
    });

    return new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(selectOptions);
}

module.exports = { createTrackSelectMenu, truncateText };
