// Utility functions that encapsulate common queue manipulations, allowing both
// slash-commands and component interactions to share the same core logic.

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
 * Plays the previous track from the queue history.
 * Returns the track that started playing, or null if none.
 */
async function playPrevious(player) {
    if (!player.queue.previous || player.queue.previous.length === 0) {
        return null;
    }

    // Remove the previous track from the history
    const previousTrack = await player.queue.shiftPrevious();
    if (!previousTrack) {
        return null;
    }

    // Put current track back to the front of the queue (so we can return to it)
    if (player.queue.current) {
        await player.queue.add(player.queue.current, 0);
    }

    // Mark the track so it's not re-added to previous again
    const previousClientData = previousTrack.pluginInfo?.clientData || {};
    previousTrack.pluginInfo = previousTrack.pluginInfo || {};
    previousTrack.pluginInfo.clientData = {
        previousTrack: true,
        ...previousClientData,
    };

    // Start playing
    await player.play({ clientTrack: previousTrack });
    return previousTrack;
}

function shuffleQueue(player) {
    player.queue.shuffle();
}

function clearQueue(player) {
    const len = player.queue.tracks.length;
    player.queue.tracks.splice(0, len);
}

/**
 * Jumps to a specific track in the queue by index
 * Removes all tracks before the target track and starts playing it
 *
 * @param {Object} player - Lavalink player instance
 * @param {number} trackIndex - Zero-based index of track to jump to
 * @returns {Object|null} The track that will be played, or null if invalid
 */
async function jumpToTrack(player, trackIndex) {
    if (!player || !player.queue.tracks.length) {
        return null;
    }

    // Validate index
    if (trackIndex < 0 || trackIndex >= player.queue.tracks.length) {
        return null;
    }

    // Get the target track
    const targetTrack = player.queue.tracks[trackIndex];
    if (!targetTrack) {
        return null;
    }

    // Remove all tracks before the target track (optimization: single splice)
    player.queue.tracks.splice(0, trackIndex);

    // Skip to the new first track (which is our target)
    await player.skip();

    return targetTrack;
}

function paginatedQueue(player, page = 1, itemsPerPage = 9) {
    const tracks = player.queue.tracks;

    if (!tracks.length) {
        return {
            tracks: [],
            currentPage: 1,
            totalPages: 1,
            totalTracks: 0,
            hasNext: false,
            hasPrevious: false,
            startIndex: 0,
            endIndex: 0
        };
    }

    const totalTracks = tracks.length;
    const totalPages = Math.ceil(totalTracks / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalTracks);

    // Get tracks for current page
    const pageTracks = tracks.slice(startIndex, endIndex);

    return {
        tracks: pageTracks,
        currentPage,
        totalPages,
        totalTracks,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
        startIndex,
        endIndex
    };
}

function createPaginatedQueueResponse(client, player, page = 1) {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
    const lang = client.defaultLanguage;
    const t = (key, ...args) => client.languageManager.get(lang, key, ...args);

    const pageData = paginatedQueue(player, page, 9);

    // Handle empty queue
    if (!pageData.tracks.length) {
        return {
            content: t('QUEUE_EMPTY'),
            ephemeral: true
        };
    }

    // Build track list
    const trackLines = pageData.tracks.map((track, index) => {
        const displayIndex = pageData.startIndex + index + 1;
        const title = truncateText(track.info?.title || 'Unknown', 45);
        const artist = truncateText(track.info?.author || 'Unknown', 20);
        return `${displayIndex}. ${title} — ${artist}`;
    });

    const description = trackLines.join('\n');

    // Create embed
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(t('QUEUE_HEADER', pageData.totalTracks))
        .setDescription(description.length > 4000 ? description.substring(0, 4000) + '\n...' : description)
        .setFooter({
            text: t('QUEUE_PAGE_FOOTER', pageData.currentPage, pageData.totalPages)
        });

    const components = [];

    // Navigation row (if multiple pages)
    if (pageData.totalPages > 1) {
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('queue:first:1')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageData.currentPage === 1),
            new ButtonBuilder()
                .setCustomId(`queue:prev:${page - 1}`)
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!pageData.hasPrevious),
            new ButtonBuilder()
                .setCustomId(`queue:next:${page + 1}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!pageData.hasNext),
            new ButtonBuilder()
                .setCustomId(`queue:last:${pageData.totalPages}`)
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageData.currentPage === pageData.totalPages)
        );
        components.push(navRow);
    }

    // Select menu for track jumping
    const selectOptions = pageData.tracks.slice(0, 25).map((track, index) => {
        const globalIndex = pageData.startIndex + index;
        const displayNum = globalIndex + 1;
        const title = truncateText(track.info?.title || 'Unknown', 50);
        const artist = truncateText(track.info?.author || 'Unknown', 50);

        return {
            label: `${displayNum}. ${title}`,
            description: artist.substring(0, 100),
            value: `${globalIndex}:${page}`,
            emoji: '▶️'
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('queue:select')
        .setPlaceholder(t('QUEUE_SELECT_PLACEHOLDER'))
        .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    return {
        embeds: [embed],
        components,
        ephemeral: true
    };
}

function formattedQueue(player, limit = 10) {
    if (!player.queue.tracks.length) return '';
    const list = player.queue.tracks
        .slice(0, limit)
        .map((track, i) => `${i + 1}. ${track.info?.title || 'Unknown'}`)
        .join('\n');
    const remaining = player.queue.tracks.length - limit;
    return remaining > 0 ? `${list}\n…and ${remaining} more` : list;
}

module.exports = {
    playPrevious,
    shuffleQueue,
    clearQueue,
    jumpToTrack,
    formattedQueue,
    paginatedQueue,
    createPaginatedQueueResponse,
}; 