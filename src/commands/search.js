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

const { SlashCommandBuilder } = require('discord.js');
const searchSessions = require('../utils/searchSessions');
const { isLavalinkAvailable, handleLavalinkError } = require('../utils/interactionHelpers');
const { createSearchEmbed, createSearchButtons } = require('../utils/embeds');

// Validate and clamp volume to valid range (0-100)
function getValidVolume(envValue, defaultValue = 80) {
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed)) return defaultValue;
    return Math.max(0, Math.min(100, parsed)); // Clamp between 0-100
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