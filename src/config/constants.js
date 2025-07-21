/**
 * Application Constants
 * Centralized configuration values and magic numbers
 */

// Search Session Configuration
const SEARCH_SESSION = {
    // Session cleanup intervals
    CLEANUP_INTERVAL_MS: 300000,        // 5 minutes
    SESSION_MAX_AGE_MS: 1800000,        // 30 minutes
    
    // Pagination settings
    TRACKS_PER_PAGE: 5,
    MAX_SEARCH_QUERY_LENGTH: 200,
    
    // Discord API limits
    MAX_BUTTONS_PER_ROW: 5,
    MAX_ACTION_ROWS: 5,
    
    // Session ID generation
    ID_ENTROPY_BYTES: 16,               // 128 bits of entropy
    MAX_COLLISION_RETRIES: 3
};

// Player Configuration
const PLAYER = {
    DEFAULT_VOLUME: 80,
    MIN_VOLUME: 0,
    MAX_VOLUME: 100,
    
    // Timeouts
    QUEUE_EMPTY_DESTROY_MS: 30000,      // 30 seconds
    PLAYER_UPDATE_DELAY_MS: 100,
    TRACK_END_UPDATE_DELAY_MS: 500,
    
    // Position update interval
    POSITION_UPDATE_INTERVAL_MS: 150
};

// Shutdown Configuration
const SHUTDOWN = {
    GRACEFUL_TIMEOUT_MS: 5000,          // 5 seconds max for graceful shutdown
    FORCE_EXIT_DELAY_MS: 1000           // 1 second delay before force exit
};

// Error Types
const ERROR_TYPES = {
    SEARCH_SESSION: {
        SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
        SESSION_EXPIRED: 'SESSION_EXPIRED',
        INVALID_USER: 'INVALID_USER',
        INVALID_TRACK_INDEX: 'INVALID_TRACK_INDEX',
        SESSION_CREATION_FAILED: 'SESSION_CREATION_FAILED'
    },
    PLAYER: {
        PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
        VOICE_CHANNEL_MISMATCH: 'VOICE_CHANNEL_MISMATCH',
        PLAYER_CREATION_FAILED: 'PLAYER_CREATION_FAILED'
    },
    VALIDATION: {
        INVALID_INPUT: 'INVALID_INPUT',
        MALFORMED_CUSTOM_ID: 'MALFORMED_CUSTOM_ID',
        SANITIZATION_FAILED: 'SANITIZATION_FAILED'
    }
};

// Custom ID Patterns for validation
const CUSTOM_ID_PATTERNS = {
    SEARCH_PREFIX: /^search_/,
    SEARCH_NAVIGATION: /^search_(prev|next|cancel)_[a-zA-Z0-9_-]+$/,
    SEARCH_TOGGLE: /^search_toggle_[a-zA-Z0-9_-]+_\d+$/,
    PLAYER_ACTION: /^player_(back|playpause|skip|stop|shuffle|queue|clear|loop)$/,
    QUEUE_PAGINATION: /^queue_(prev|next)_\d+$/
};

// Input Sanitization
const SANITIZATION = {
    MAX_CUSTOM_ID_LENGTH: 100,
    ALLOWED_CUSTOM_ID_CHARS: /^[a-zA-Z0-9_-]+$/,
    MAX_SESSION_ID_LENGTH: 64
};

module.exports = {
    SEARCH_SESSION,
    PLAYER,
    SHUTDOWN,
    ERROR_TYPES,
    CUSTOM_ID_PATTERNS,
    SANITIZATION
};