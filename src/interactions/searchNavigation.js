const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const searchSessions = require('../utils/searchSessions');
const { isLavalinkAvailable } = require('../utils/interactionHelpers');

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

/**
 * Handles search navigation button interactions
 *
 * Processes button interactions from the search interface, including:
 * - Pagination (previous/next page)
 * - Track selection/deselection
 * - Session cancellation
 *
 * Validates user permissions, session ownership, and input data before
 * processing actions. Implements proper error handling and user feedback.
 *
 * @param {Object} interaction - Discord button interaction object
 * @returns {Promise<void>} Resolves when interaction is fully processed
 * @throws {Error} If interaction processing fails
 */
async function handleSearchNavigation(interaction) {
    const { client, customId, user, guild } = interaction;
    const lang = client.defaultLanguage;

    try {
        // Validate and parse custom ID
        if (!customId || typeof customId !== 'string') {
            return;
        }
        
        // Use regex for safer parsing with input validation
        const customIdPattern = /^search_(?<action>[a-z]+)(?:_(?<subaction>[a-z]+))?(?:_(?<sessionId>[^_]+))?(?:_(?<extra>[^_]+))?$/;
        const match = customId.match(customIdPattern);
        
        if (!match || !match.groups) {
            return;
        }
        
        const { action, subaction, sessionId, extra } = match.groups;
        
        // Validate action type
        const validActions = ['prev', 'next', 'toggle', 'add', 'cancel'];
        if (!validActions.includes(action)) {
            return;
        }
        
        // Handle different action types
        let parsedExtra = [];
        
        if (action === 'toggle' && sessionId && extra) {
            // Format: search_toggle_sessionId_trackIndex
            parsedExtra = [extra];
        } else if (action === 'add' && subaction === 'selected' && sessionId) {
            // Format: search_add_selected_sessionId
            parsedExtra = ['selected'];
        } else if (sessionId) {
            // Format: search_action_sessionId
            if (subaction) {
                parsedExtra = [subaction];
            }
        } else {
            // Invalid format
            return;
        }
        
        // Sanitize sessionId to prevent injection attacks
        const sessionIdPattern = /^[a-zA-Z0-9-]+$/;
        if (!sessionId || !sessionIdPattern.test(sessionId)) {
            return;
        }
        
        // Use parsed values
        const parsedAction = action;
        const parsedSessionId = sessionId;
        const parsedExtraArray = parsedExtra;

        // Get search session
        const session = searchSessions.getSession(parsedSessionId);
        
        if (!session) {
            return interaction.reply({
                content: client.languageManager.get(lang, 'SEARCH_SESSION_EXPIRED'),
                ephemeral: true
            });
        }
        
        // Validate session ownership
        if (session.userId !== user.id) {
            return interaction.reply({
                content: client.languageManager.get(lang, 'SEARCH_NOT_YOUR_SESSION'),
                ephemeral: true
            });
        }
        
        // Validate guild membership
        if (session.guildId !== guild.id) {
            return interaction.reply({
                content: client.languageManager.get(lang, 'SEARCH_NOT_YOUR_SESSION'),
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

        // Check if Lavalink is available
        if (!isLavalinkAvailable(client)) {
            return interaction.reply({
                content: client.languageManager.get(lang, 'LAVALINK_UNAVAILABLE'),
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

        switch (parsedAction) {
            case 'prev':
                // Navigate to previous page
                const prevPage = session.currentPage - 1;
                if (searchSessions.updatePage(parsedSessionId, prevPage)) {
                    shouldUpdate = true;
                }
                break;

            case 'next':
                // Navigate to next page
                const nextPage = session.currentPage + 1;
                if (searchSessions.updatePage(parsedSessionId, nextPage)) {
                    shouldUpdate = true;
                }
                break;

            case 'toggle':
                // Toggle track selection and auto-add/remove from queue
                if (parsedExtraArray.length > 0) {
                    const trackIndex = parseInt(parsedExtraArray[0]);
                    if (!isNaN(trackIndex)) {
                        // Get fresh session data
                        const currentSession = searchSessions.getSession(parsedSessionId);
                        const track = currentSession.tracks[trackIndex];
                        if (track) {
                            // Check current selection state before toggling
                            const wasSelected = currentSession.selectedTracks.has(trackIndex);
                            
                            // Toggle the selection
                            const result = searchSessions.toggleTrackSelection(parsedSessionId, trackIndex);
                            shouldUpdate = true;
                            
                            if (!wasSelected) {
                                // Track was selected (added)
                                responseMessage = client.languageManager.get(lang, 'SEARCH_TRACK_ADDED', track.info?.title || 'Unknown');
                                
                                // Do heavy work after responding to interaction
                                setImmediate(() => {
                                    try {
                                        player.queue.add(track);
                                        searchSessions.markTrackQueued(parsedSessionId, trackIndex);
                                        
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
                                // Track was deselected (removed)
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
                                            searchSessions.unmarkTrackQueued(parsedSessionId, trackIndex);
                                            
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
                searchSessions.deleteSession(parsedSessionId);
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