const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const searchSessions = require('../utils/searchSessions');

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

/**
 * Handles search navigation button interactions
 * @param {Object} interaction - Discord button interaction
 * @returns {Promise<void>}
 */
async function handleSearchNavigation(interaction) {
    const { client, customId, user, guild } = interaction;
    const lang = client.defaultLanguage;

    try {
        // Parse custom ID to determine action and session
        const parts = customId.split('_');
        
        if (parts.length < 3) {
            return;
        }

        const [prefix, action, ...rest] = parts;
        if (prefix !== 'search') {
            return;
        }

        // Handle different action types and extract sessionId properly
        let sessionId, extra = [];
        
        if (action === 'toggle') {
            // Format: search_toggle_sessionId_trackIndex
            if (rest.length < 2) {
                return;
            }
            sessionId = rest[0];
            extra = rest.slice(1);
        } else if (action === 'add' && rest[0] === 'selected') {
            // Format: search_add_selected_sessionId
            if (rest.length < 2) {
                return;
            }
            sessionId = rest[1];
            extra = ['selected'];
        } else {
            // Format: search_action_sessionId
            if (rest.length < 1) {
                return;
            }
            sessionId = rest[0];
            extra = rest.slice(1);
        }

        // Get search session
        const session = searchSessions.getSession(sessionId);
        
        if (!session) {
            return interaction.reply({
                content: client.languageManager.get(lang, 'SEARCH_SESSION_EXPIRED'),
                ephemeral: true
            });
        }

        // Verify user owns this session
        if (session.userId !== user.id) {
            return interaction.reply({
                content: client.languageManager.get(lang, 'SEARCH_NOT_YOUR_SESSION'),
                ephemeral: true
            });
        }

        // Get player
        const player = client.lavalink.getPlayer(guild.id);
        if (!player) {
            // For pagination actions, don't delete session but show better error
            if (action === 'prev' || action === 'next') {
                return interaction.reply({
                    content: client.languageManager.get(lang, 'SEARCH_PLAYER_STOPPED'),
                    ephemeral: true
                });
            }
            // For other actions, delete session
            searchSessions.deleteSession(sessionId);
            return interaction.reply({
                content: client.languageManager.get(lang, 'SEARCH_PLAYER_STOPPED'),
                ephemeral: true
            });
        }

        let shouldUpdate = false;
        let responseMessage = null;

        switch (action) {
            case 'prev':
                // Navigate to previous page
                const prevPage = session.currentPage - 1;
                if (searchSessions.updatePage(sessionId, prevPage)) {
                    shouldUpdate = true;
                }
                break;

            case 'next':
                // Navigate to next page
                const nextPage = session.currentPage + 1;
                if (searchSessions.updatePage(sessionId, nextPage)) {
                    shouldUpdate = true;
                }
                break;

            case 'toggle':
                // Toggle track selection and auto-add/remove from queue
                if (extra.length > 0) {
                    const trackIndex = parseInt(extra[0]);
                    if (!isNaN(trackIndex)) {
                        const isSelected = searchSessions.toggleTrackSelection(sessionId, trackIndex);
                        shouldUpdate = true;
                        
                        const track = session.tracks[trackIndex];
                        if (track) {
                            if (isSelected) {
                                responseMessage = client.languageManager.get(lang, 'SEARCH_TRACK_ADDED', track.info?.title || 'Unknown');
                                
                                // Do heavy work after responding to interaction
                                setImmediate(() => {
                                    try {
                                        player.queue.add(track);
                                        searchSessions.markTrackQueued(sessionId, trackIndex);
                                        
                                        // Start playing if not already playing
                                        if (!player.playing) {
                                            player.play();
                                        }
                                        
                                        // Update player controller
                                        setTimeout(() => {
                                            const existingMessageId = client.playerController.playerMessages.get(guild.id);
                                            if (existingMessageId) {
                                                client.playerController.updatePlayer(guild.id);
                                            } else {
                                                client.playerController.sendPlayer(interaction.channel, player);
                                            }
                                        }, 100);
                                    } catch (error) {
                                        console.error('Error adding track to queue:', error);
                                    }
                                });
                            } else {
                                responseMessage = client.languageManager.get(lang, 'SEARCH_TRACK_REMOVED', track.info?.title || 'Unknown');
                                
                                // Do heavy work after responding to interaction
                                setImmediate(() => {
                                    try {
                                        // Find and remove the track from the queue
                                        const queueIndex = player.queue.tracks.findIndex(queueTrack =>
                                            queueTrack.info?.uri === track.info?.uri &&
                                            queueTrack.info?.title === track.info?.title
                                        );
                                        
                                        if (queueIndex !== -1) {
                                            player.queue.tracks.splice(queueIndex, 1);
                                            searchSessions.unmarkTrackQueued(sessionId, trackIndex);
                                            
                                            // Update player controller
                                            setTimeout(() => {
                                                client.playerController.updatePlayer(guild.id);
                                            }, 100);
                                        }
                                    } catch (error) {
                                        console.error('Error removing track from queue:', error);
                                    }
                                });
                            }
                        }
                    }
                }
                break;

            case 'cancel':
                // Cancel search and delete session
                searchSessions.deleteSession(sessionId);
                return interaction.update({
                    content: client.languageManager.get(lang, 'SEARCH_CANCELLED'),
                    embeds: [],
                    components: []
                });
        }

        // Always acknowledge the interaction immediately to prevent timeout
        await interaction.deferUpdate();

        if (shouldUpdate) {
            // Get updated page data
            const pageData = searchSessions.getCurrentPageData(sessionId);
            if (pageData) {
                const embed = createSearchEmbed(client, pageData, session.query);
                const components = createSearchButtons(client, pageData, sessionId);

                // Update the original message
                await interaction.editReply({
                    embeds: [embed],
                    components
                });
            }
        }

        // Send follow-up message if there's a response message (but don't make it ephemeral to avoid hiding the search)
        if (responseMessage) {
            // Send a temporary message that auto-deletes
            const tempMessage = await interaction.followUp({
                content: responseMessage,
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('Error handling search navigation:', error);
        
        // Try to respond to the interaction if it hasn't been responded to yet
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate();
            }
            
            // Always try to send an error message as follow-up
            await interaction.followUp({
                content: client.languageManager.get(lang, 'SEARCH_INTERACTION_ERROR'),
                ephemeral: true
            });
        } catch (responseError) {
            console.error('Failed to respond to interaction:', responseError);
        }
    }
}

module.exports = {
    handleSearchNavigation,
    createSearchEmbed,
    createSearchButtons,
    formatDuration
};