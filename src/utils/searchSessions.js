/**
 * Search Session Manager
 * Manages search results and user selections for the /search command
 *
 * This class handles the lifecycle of search sessions, including:
 * - Creating and retrieving search sessions
 * - Managing track selections and pagination
 * - Automatic cleanup of old sessions
 * - Graceful shutdown procedures
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
     * Generates a unique session ID and stores session data including tracks,
     * user selections, and pagination state. Each session is tied to a specific
     * user, guild, and search query.
     *
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {Array} tracks - Array of track objects from Lavalink
     * @param {string} query - Original search query
     * @returns {string} Unique session identifier
     * @throws {Error} If required parameters are missing or invalid
     */
    createSession(userId, guildId, tracks, query) {
        // Use a more robust session ID generation to prevent duplicates
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        const sessionId = `${userId}-${timestamp}-${randomSuffix}`;
        
        const sessionData = {
            sessionId,
            userId,
            guildId,
            query,
            tracks,
            selectedTracks: new Set(), // Track indices that are selected
            queuedTracks: new Set(), // Track indices that are actually in the queue
            currentPage: 1,
            tracksPerPage: 5,
            createdAt: Date.now()
        };

        this.sessions.set(sessionId, sessionData);
        return sessionId;
    }

    /**
     * Gets a search session by ID
     *
     * Retrieves session data for a given session ID. Returns null if the session
     * does not exist or has expired.
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
     * Changes the current page of a search session, ensuring the page number
     * is within valid bounds (1 to total pages). This is used for pagination
     * navigation in search results.
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
     * Toggles track selection for a session
     * @param {string} sessionId - Session identifier
     * @param {number} trackIndex - Index of track to toggle
     * @returns {Object} Result object with success status and optional error message
     */
    toggleTrackSelection(sessionId, trackIndex) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'SESSION_NOT_FOUND' };
        }
        
        if (trackIndex < 0 || trackIndex >= session.tracks.length) {
            return { success: false, error: 'INVALID_TRACK_INDEX' };
        }

        if (session.selectedTracks.has(trackIndex)) {
            session.selectedTracks.delete(trackIndex);
            return { success: true, action: 'DESELECTED' };
        } else {
            session.selectedTracks.add(trackIndex);
            return { success: true, action: 'SELECTED' };
        }
    }

    /**
     * Gets selected tracks for a session
     * @param {string} sessionId - Session identifier
     * @returns {Array} Array of selected track objects
     */
    getSelectedTracks(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return [];

        return Array.from(session.selectedTracks).map(index => session.tracks[index]);
    }

    /**
     * Gets tracks for current page
     * @param {string} sessionId - Session identifier
     * @returns {Object} Page data with tracks and pagination info
     */
    getCurrentPageData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const { tracks, currentPage, tracksPerPage, selectedTracks } = session;
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
            selectedTracks: Array.from(selectedTracks),
            selectedCount: selectedTracks.size
        };
    }

    /**
     * Marks a track as queued
     * @param {string} sessionId - Session identifier
     * @param {number} trackIndex - Index of track to mark as queued
     * @returns {boolean} Success status
     */
    markTrackQueued(sessionId, trackIndex) {
        const session = this.sessions.get(sessionId);
        if (!session || trackIndex < 0 || trackIndex >= session.tracks.length) {
            return false;
        }

        session.queuedTracks.add(trackIndex);
        return true;
    }

    /**
     * Unmarks a track as queued
     * @param {string} sessionId - Session identifier
     * @param {number} trackIndex - Index of track to unmark as queued
     * @returns {boolean} Success status
     */
    unmarkTrackQueued(sessionId, trackIndex) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.queuedTracks.delete(trackIndex);
        return true;
    }

    /**
     * Checks if a track is queued
     * @param {string} sessionId - Session identifier
     * @param {number} trackIndex - Index of track to check
     * @returns {boolean} True if track is queued
     */
    isTrackQueued(sessionId, trackIndex) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        return session.queuedTracks.has(trackIndex);
    }

    /**
     * Clears all selections for a session
     * @param {string} sessionId - Session identifier
     * @returns {boolean} Success status
     */
    clearSelections(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.selectedTracks.clear();
        return true;
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
     * Cleans up old sessions (manual cleanup since no auto-timeout)
     * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
     * @returns {number} Number of sessions cleaned up
     */
    cleanupOldSessions(maxAge = this.SESSION_MAX_AGE * 2) { // Default to twice the session max age
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
     * Gets the number of active sessions
     * @returns {number} Number of active sessions
     */
    getSessionCount() {
        return this.sessions.size;
    }

    /**
     * Gets all sessions for a specific user
     * @param {string} userId - Discord user ID
     * @returns {Array} Array of session data for the user
     */
    getUserSessions(userId) {
        const userSessions = [];
        for (const session of this.sessions.values()) {
            if (session.userId === userId) {
                userSessions.push(session);
            }
        }
        return userSessions;
    }

    /**
     * Gets all sessions for a specific guild
     * @param {string} guildId - Discord guild ID
     * @returns {Array} Array of session data for the guild
     */
    getGuildSessions(guildId) {
        const guildSessions = [];
        for (const session of this.sessions.values()) {
            if (session.guildId === guildId) {
                guildSessions.push(session);
            }
        }
        return guildSessions;
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
     * Cleans up all sessions for a specific user in a specific guild
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @returns {number} Number of sessions cleaned up
     */
    cleanupUserGuildSessions(userId, guildId) {
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.userId === userId && session.guildId === guildId) {
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