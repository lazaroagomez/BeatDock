/**
 * Search Session Manager
 * Manages search results and user selections for the /search command
 */

class SearchSessionManager {
    constructor() {
        // Map structure: sessionId -> sessionData
        this.sessions = new Map();
        
        // Start automatic cleanup interval (every 5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldSessions(1800000); // Clean sessions older than 30 minutes
        }, 300000); // Check every 5 minutes
    }

    /**
     * Creates a new search session for a user
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {Array} tracks - Array of track objects from Lavalink
     * @param {string} query - Original search query
     * @returns {string} sessionId
     */
    createSession(userId, guildId, tracks, query) {
        const sessionId = `${userId}-${Date.now()}`;
        
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
     * @param {string} sessionId - Session identifier
     * @returns {Object|null} Session data or null if not found
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Updates the current page for a session
     * @param {string} sessionId - Session identifier
     * @param {number} page - New page number
     * @returns {boolean} Success status
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
     * @returns {boolean} New selection state (true if selected, false if deselected)
     */
    toggleTrackSelection(sessionId, trackIndex) {
        const session = this.sessions.get(sessionId);
        if (!session || trackIndex < 0 || trackIndex >= session.tracks.length) {
            return false;
        }

        if (session.selectedTracks.has(trackIndex)) {
            session.selectedTracks.delete(trackIndex);
            return false;
        } else {
            session.selectedTracks.add(trackIndex);
            return true;
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
    cleanupOldSessions(maxAge = 3600000) { // 1 hour default
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