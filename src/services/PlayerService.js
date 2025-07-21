/**
 * Player Service
 * Handles player creation, management, and validation logic
 */

const { PLAYER, ERROR_TYPES } = require('../config/constants');
const { createError } = require('../utils/securityUtils');

class PlayerService {
    constructor(client) {
        this.client = client;
        this.lavalink = client.lavalink;
    }

    /**
     * Validates and clamps volume to valid range
     * @param {string|number} envValue - Environment value for volume
     * @param {number} defaultValue - Default volume value
     * @returns {number} Valid volume between 0-100
     */
    getValidVolume(envValue, defaultValue = PLAYER.DEFAULT_VOLUME) {
        const parsed = parseInt(envValue, 10);
        if (isNaN(parsed)) return defaultValue;
        return Math.max(PLAYER.MIN_VOLUME, Math.min(PLAYER.MAX_VOLUME, parsed));
    }

    /**
     * Creates or retrieves a player for the guild
     * @param {Object} options - Player creation options
     * @param {string} options.guildId - Guild ID
     * @param {string} options.voiceChannelId - Voice channel ID
     * @param {string} options.textChannelId - Text channel ID
     * @param {number} [options.volume] - Player volume
     * @returns {Object} Player instance
     * @throws {Error} If player creation fails
     */
    async createOrGetPlayer({ guildId, voiceChannelId, textChannelId, volume }) {
        try {
            // Check if player already exists
            let player = this.lavalink.getPlayer(guildId);
            
            if (player) {
                // Validate voice channel consistency
                if (player.voiceChannelId !== voiceChannelId) {
                    throw createError(
                        ERROR_TYPES.PLAYER.VOICE_CHANNEL_MISMATCH,
                        'Player is connected to a different voice channel',
                        { 
                            currentChannel: player.voiceChannelId, 
                            requestedChannel: voiceChannelId 
                        }
                    );
                }
                return player;
            }

            // Create new player
            const playerVolume = volume !== undefined 
                ? this.getValidVolume(volume) 
                : this.getValidVolume(process.env.DEFAULT_VOLUME);

            player = this.lavalink.createPlayer({
                guildId,
                voiceChannelId,
                textChannelId,
                selfDeaf: true,
                selfMute: false,
                volume: playerVolume,
            });

            // Connect the player
            await player.connect();

            console.log(`Created new player for guild ${guildId} in channel ${voiceChannelId}`);
            return player;

        } catch (error) {
            console.error('Failed to create or get player:', error);
            
            // If it's already our custom error, re-throw it
            if (error.type) {
                throw error;
            }

            // Otherwise, wrap it in our error format
            throw createError(
                ERROR_TYPES.PLAYER.PLAYER_CREATION_FAILED,
                'Failed to create or retrieve player',
                { guildId, voiceChannelId, textChannelId, originalError: error.message }
            );
        }
    }

    /**
     * Validates that a player exists for the guild
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Player instance or null if not found
     */
    getPlayer(guildId) {
        return this.lavalink.getPlayer(guildId);
    }

    /**
     * Validates that a player exists and throws descriptive error if not
     * @param {string} guildId - Guild ID
     * @returns {Object} Player instance
     * @throws {Error} If player not found
     */
    requirePlayer(guildId) {
        const player = this.getPlayer(guildId);
        
        if (!player) {
            throw createError(
                ERROR_TYPES.PLAYER.PLAYER_NOT_FOUND,
                'No active player found for this guild',
                { guildId }
            );
        }

        return player;
    }

    /**
     * Validates that user is in the same voice channel as the player
     * @param {Object} member - Discord member object
     * @param {Object} player - Player instance
     * @returns {boolean} True if in same channel
     * @throws {Error} If not in same voice channel
     */
    validateSameVoiceChannel(member, player) {
        const userVoiceChannel = member.voice.channel;
        
        if (!userVoiceChannel) {
            throw createError(
                ERROR_TYPES.PLAYER.VOICE_CHANNEL_MISMATCH,
                'User is not in a voice channel',
                { playerChannel: player.voiceChannelId }
            );
        }

        if (userVoiceChannel.id !== player.voiceChannelId) {
            throw createError(
                ERROR_TYPES.PLAYER.VOICE_CHANNEL_MISMATCH,
                'User must be in the same voice channel as the player',
                { 
                    userChannel: userVoiceChannel.id, 
                    playerChannel: player.voiceChannelId 
                }
            );
        }

        return true;
    }

    /**
     * Performs a search using the player
     * @param {Object} player - Player instance
     * @param {string} query - Search query
     * @param {Object} user - Discord user object
     * @returns {Object} Search results
     * @throws {Error} If search fails
     */
    async searchTracks(player, query, user) {
        try {
            const searchResult = await player.search({
                query: query.trim(),
            }, user);

            if (!searchResult || !searchResult.tracks.length) {
                throw createError(
                    ERROR_TYPES.SEARCH_SESSION.SESSION_CREATION_FAILED,
                    'No tracks found for the search query',
                    { query }
                );
            }

            return searchResult;

        } catch (error) {
            console.error('Search failed:', error);
            
            if (error.type) {
                throw error;
            }

            throw createError(
                ERROR_TYPES.SEARCH_SESSION.SESSION_CREATION_FAILED,
                'Failed to search for tracks',
                { query, originalError: error.message }
            );
        }
    }

    /**
     * Adds a track to the player queue
     * @param {Object} player - Player instance
     * @param {Object} track - Track object
     * @returns {boolean} Success status
     */
    addTrackToQueue(player, track) {
        try {
            player.queue.add(track);
            
            // Start playing if not already playing
            if (!player.playing && !player.paused) {
                player.play();
            }

            return true;
        } catch (error) {
            console.error('Failed to add track to queue:', error);
            return false;
        }
    }

    /**
     * Removes a track from the player queue
     * @param {Object} player - Player instance
     * @param {Object} track - Track object to remove
     * @returns {boolean} Success status
     */
    removeTrackFromQueue(player, track) {
        try {
            const queueIndex = player.queue.tracks.findIndex(queueTrack =>
                queueTrack.info?.uri === track.info?.uri &&
                queueTrack.info?.title === track.info?.title
            );
            
            if (queueIndex !== -1) {
                player.queue.tracks.splice(queueIndex, 1);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to remove track from queue:', error);
            return false;
        }
    }

    /**
     * Updates the player controller UI
     * @param {string} guildId - Guild ID
     * @param {Object} [channel] - Text channel for new player messages
     */
    updatePlayerController(guildId, channel = null) {
        try {
            setTimeout(() => {
                const existingMessageId = this.client.playerController.playerMessages.get(guildId);
                if (existingMessageId) {
                    this.client.playerController.updatePlayer(guildId);
                } else if (channel) {
                    const player = this.getPlayer(guildId);
                    if (player) {
                        this.client.playerController.sendPlayer(channel, player);
                    }
                }
            }, PLAYER.PLAYER_UPDATE_DELAY_MS);
        } catch (error) {
            console.error('Failed to update player controller:', error);
        }
    }
}

module.exports = PlayerService;