// Utility functions that encapsulate common queue manipulations, allowing both
// slash-commands and component interactions to share the same core logic.

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

function paginatedQueue(player, page = 1, itemsPerPage = 10) {
    if (!player.queue.tracks.length) {
        return {
            content: '',
            currentPage: 1,
            totalPages: 1,
            totalTracks: 0,
            hasNext: false,
            hasPrevious: false
        };
    }

    const totalTracks = player.queue.tracks.length;
    const totalPages = Math.ceil(totalTracks / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalTracks);
    
    const tracks = player.queue.tracks.slice(startIndex, endIndex);
    const list = tracks
        .map((track, i) => `${startIndex + i + 1}. ${track.info?.title || 'Unknown'}`)
        .join('\n');
    
    return {
        content: list,
        currentPage,
        totalPages,
        totalTracks,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
        startIndex: startIndex + 1,
        endIndex
    };
}

function createPaginatedQueueResponse(client, player, page = 1) {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const lang = client.defaultLanguage;
    
    const queueData = paginatedQueue(player, page);
    
    if (!queueData.content) {
        return {
            content: client.languageManager.get(lang, 'QUEUE_EMPTY'),
            ephemeral: true
        };
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(client.languageManager.get(lang, 'QUEUE_TITLE'))
        .setDescription(queueData.content)
        .setFooter({ 
            text: `Page ${queueData.currentPage}/${queueData.totalPages} • ${queueData.totalTracks} tracks • Showing ${queueData.startIndex}-${queueData.endIndex}`
        });
    
    const components = [];
    
    if (queueData.totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`queue:prev:${page - 1}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!queueData.hasPrevious),
                new ButtonBuilder()
                    .setCustomId(`queue:next:${page + 1}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!queueData.hasNext)
            );
        components.push(row);
    }
    
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
    formattedQueue,
    paginatedQueue,
    createPaginatedQueueResponse,
}; 