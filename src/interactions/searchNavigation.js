const searchSessions = require('../utils/searchSessions');
const { isLavalinkAvailable } = require('../utils/interactionHelpers');
const { createSearchEmbed, createSearchButtons } = require('../utils/embeds');

async function handleSearchNavigation(interaction) {
    const { client, customId, user, guild } = interaction;
    const lang = client.defaultLanguage;

    try {
        const parts = customId.split(':');
        const [component, action, sessionId, ...args] = parts;

        if (component !== 'search') return;

        // Get search session
        const session = searchSessions.getSession(sessionId);
        
        if (!session) {
            return interaction.update({
                content: client.languageManager.get(lang, 'SEARCH_SESSION_EXPIRED'),
                embeds: [],
                components: []
            });
        }
        
        // Validate session ownership
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
            searchSessions.deleteSession(sessionId);
            return interaction.update({
                content: client.languageManager.get(lang, 'SEARCH_PLAYER_STOPPED'),
                embeds: [],
                components: []
            });
        }

        let shouldUpdate = false;
        let responseMessage = null;

        await interaction.deferUpdate();

        switch (action) {
            case 'prev':
                if (searchSessions.updatePage(sessionId, session.currentPage - 1)) {
                    shouldUpdate = true;
                }
                break;

            case 'next':
                if (searchSessions.updatePage(sessionId, session.currentPage + 1)) {
                    shouldUpdate = true;
                }
                break;

            case 'toggle':
                const trackIndex = parseInt(args[0]);
                if (!isNaN(trackIndex)) {
                    const track = session.tracks[trackIndex];
                    if (track) {
                        const wasSelected = session.selectedTracks.has(trackIndex);
                        searchSessions.toggleTrackSelection(sessionId, trackIndex);
                        shouldUpdate = true;
                        
                        if (!wasSelected) {
                            responseMessage = client.languageManager.get(lang, 'SEARCH_TRACK_ADDED', track.info?.title || 'Unknown');
                            player.queue.add(track);
                            if (!player.playing) player.play();
                        } else {
                            responseMessage = client.languageManager.get(lang, 'SEARCH_TRACK_REMOVED', track.info?.title || 'Unknown');
                            const queueIndex = player.queue.tracks.findIndex(t => t.info?.uri === track.info?.uri);
                            if (queueIndex !== -1) player.queue.tracks.splice(queueIndex, 1);
                        }
                        // Update player controller async
                        setTimeout(() => client.playerController.updatePlayer(guild.id).catch(() => {}), 100);
                    }
                }
                break;

            case 'cancel':
                searchSessions.deleteSession(sessionId);
                await interaction.editReply({
                    content: client.languageManager.get(lang, 'SEARCH_CANCELLED'),
                    embeds: [],
                    components: []
                });
                return; // Exit early
        }

        if (shouldUpdate) {
            const pageData = searchSessions.getCurrentPageData(sessionId);
            if (pageData) {
                const embed = createSearchEmbed(client, pageData, session.query);
                const components = createSearchButtons(client, pageData, sessionId);
                await interaction.editReply({ embeds: [embed], components });
            }
        }

        if (responseMessage) {
            await interaction.followUp({ content: responseMessage, ephemeral: true });
        }

    } catch (error) {
        console.error('Error handling search navigation:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate();
            }
            await interaction.followUp({
                content: client.languageManager.get(lang, 'SEARCH_INTERACTION_ERROR'),
                ephemeral: true
            });
        } catch (responseError) {
            console.error('Failed to send error response for search navigation:', responseError);
        }
    }
}

module.exports = {
    handleSearchNavigation,
};