/**
 * Search Session Manager
 * Manages search results and pagination for the /search command
 *
 * @class SearchSessionManager
 */

class SearchSessionManager {
    constructor() {
        // Map structure: sessionId -> sessionData
        this.sessions = new Map();

        // Define constants for cleanup intervals
        this.SESSION_MAX_AGE = 1800000; // 30 minutes in milliseconds
        this.CLEANUP_INTERVAL = 300000; // 5 minutes in milliseconds

        // Start automatic cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldSessions(this.SESSION_MAX_AGE);
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Creates a new search session for a user
     *
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {Array} tracks - Array of track objects from Lavalink
     * @param {string} query - Original search query
     * @param {string} voiceChannelId - Voice channel ID for deferred player creation
     * @param {string} textChannelId - Text channel ID for player messages
     * @returns {string} Unique session identifier
     */
    createSession(userId, guildId, tracks, query, voiceChannelId, textChannelId) {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        const sessionId = `${userId}-${timestamp}-${randomSuffix}`;

        const sessionData = {
            sessionId,
            userId,
            guildId,
            query,
            tracks,
            currentPage: 1,
            tracksPerPage: 5,
            createdAt: Date.now(),
            voiceChannelId,
            textChannelId,
        };

        this.sessions.set(sessionId, sessionData);
        return sessionId;
    }

    /**
     * Gets a search session by ID
     *
     * @param {string} sessionId - Session identifier
     * @returns {Object|null} Session data object or null if not found
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Updates the current page for a session
     *
     * @param {string} sessionId - Session identifier
     * @param {number} page - New page number (1-indexed)
     * @returns {boolean} True if page was successfully updated, false otherwise
     */
    updatePage(sessionId, page) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        const totalPages = Math.ceil(session.tracks.length / session.tracksPerPage);
        const validPage = Math.max(1, Math.min(page, totalPages));

        session.currentPage = validPage;
        return true;
    }

    /**
     * Gets tracks for current page
     * @param {string} sessionId - Session identifier
     * @returns {Object} Page data with tracks and pagination info
     */
    getCurrentPageData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const { tracks, currentPage, tracksPerPage } = session;
        const totalPages = Math.ceil(tracks.length / tracksPerPage);

        const startIndex = (currentPage - 1) * tracksPerPage;
        const endIndex = Math.min(startIndex + tracksPerPage, tracks.length);
        const pageTracks = tracks.slice(startIndex, endIndex);

        return {
            tracks: pageTracks,
            currentPage,
            totalPages,
            totalTracks: tracks.length,
            hasNext: currentPage < totalPages,
            hasPrevious: currentPage > 1,
            startIndex,
            endIndex,
        };
    }

    /**
     * Deletes a search session
     * @param {string} sessionId - Session identifier
     * @returns {boolean} Success status
     */
    deleteSession(sessionId) {
        return this.sessions.delete(sessionId);
    }

    /**
     * Cleans up old sessions
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of sessions cleaned up
     */
    cleanupOldSessions(maxAge = this.SESSION_MAX_AGE * 2) {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.createdAt > maxAge) {
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Cleans up all sessions for a specific guild
     * @param {string} guildId - Discord guild ID
     * @returns {number} Number of sessions cleaned up
     */
    cleanupGuildSessions(guildId) {
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.guildId === guildId) {
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }
        return cleaned;
    }

    /**
     * Cleanup method for graceful shutdown
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.sessions.clear();
    }
}

// Export singleton instance
module.exports = new SearchSessionManager();
