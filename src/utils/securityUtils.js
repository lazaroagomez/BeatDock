/**
 * Security Utilities
 * Provides secure session ID generation, input validation, and sanitization
 */

const crypto = require('crypto');
const { SEARCH_SESSION, CUSTOM_ID_PATTERNS, SANITIZATION, ERROR_TYPES } = require('../config/constants');

/**
 * Generates a cryptographically secure session ID with collision prevention
 * @param {Set} existingIds - Set of existing session IDs to check for collisions
 * @param {string} userId - User ID to include in the session ID
 * @returns {string} Secure session ID
 * @throws {Error} If unable to generate unique ID after max retries
 */
function generateSecureSessionId(existingIds, userId) {
    for (let attempt = 0; attempt < SEARCH_SESSION.MAX_COLLISION_RETRIES; attempt++) {
        // Generate cryptographically secure random bytes
        const randomBytes = crypto.randomBytes(SEARCH_SESSION.ID_ENTROPY_BYTES);
        const randomHex = randomBytes.toString('hex');
        
        // Create session ID with timestamp and random component
        const timestamp = Date.now().toString(36); // Base36 for shorter string
        const sessionId = `${userId}_${timestamp}_${randomHex}`;
        
        // Check for collision
        if (!existingIds.has(sessionId)) {
            return sessionId;
        }
    }
    
    throw new Error('Failed to generate unique session ID after maximum retries');
}

/**
 * Validates and sanitizes custom ID input
 * @param {string} customId - Custom ID to validate
 * @returns {Object} Validation result with success flag and sanitized value
 */
function validateCustomId(customId) {
    const result = {
        isValid: false,
        sanitized: null,
        error: null
    };

    // Check if customId exists and is a string
    if (!customId || typeof customId !== 'string') {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: 'Custom ID must be a non-empty string'
        };
        return result;
    }

    // Check length
    if (customId.length > SANITIZATION.MAX_CUSTOM_ID_LENGTH) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: `Custom ID exceeds maximum length of ${SANITIZATION.MAX_CUSTOM_ID_LENGTH}`
        };
        return result;
    }

    // Sanitize by removing any potentially dangerous characters
    const sanitized = customId.replace(/[^\w\-_]/g, '');
    
    // Check if sanitization removed too much
    if (sanitized.length === 0) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.SANITIZATION_FAILED,
            message: 'Custom ID contains no valid characters after sanitization'
        };
        return result;
    }

    // Validate against allowed patterns
    if (!SANITIZATION.ALLOWED_CUSTOM_ID_CHARS.test(sanitized)) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: 'Custom ID contains invalid characters'
        };
        return result;
    }

    result.isValid = true;
    result.sanitized = sanitized;
    return result;
}

/**
 * Parses and validates search navigation custom IDs
 * @param {string} customId - Custom ID to parse
 * @returns {Object} Parsed result with action, sessionId, and extra data
 */
function parseSearchCustomId(customId) {
    const result = {
        isValid: false,
        action: null,
        sessionId: null,
        extra: [],
        error: null
    };

    // First validate and sanitize the input
    const validation = validateCustomId(customId);
    if (!validation.isValid) {
        result.error = validation.error;
        return result;
    }

    const sanitizedId = validation.sanitized;

    // Check if it's a search-related custom ID
    if (!CUSTOM_ID_PATTERNS.SEARCH_PREFIX.test(sanitizedId)) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.MALFORMED_CUSTOM_ID,
            message: 'Not a search custom ID'
        };
        return result;
    }

    // Split and validate structure
    const parts = sanitizedId.split('_');
    if (parts.length < 3) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.MALFORMED_CUSTOM_ID,
            message: 'Insufficient parts in custom ID'
        };
        return result;
    }

    const [prefix, action, ...rest] = parts;

    // Validate prefix
    if (prefix !== 'search') {
        result.error = {
            type: ERROR_TYPES.VALIDATION.MALFORMED_CUSTOM_ID,
            message: 'Invalid prefix'
        };
        return result;
    }

    // Validate action and extract sessionId based on action type
    let sessionId, extra = [];

    switch (action) {
        case 'toggle':
            // Format: search_toggle_sessionId_trackIndex
            if (rest.length < 2) {
                result.error = {
                    type: ERROR_TYPES.VALIDATION.MALFORMED_CUSTOM_ID,
                    message: 'Toggle action requires sessionId and trackIndex'
                };
                return result;
            }
            sessionId = rest[0];
            extra = rest.slice(1);
            
            // Validate track index is numeric
            const trackIndex = parseInt(extra[0]);
            if (isNaN(trackIndex) || trackIndex < 0) {
                result.error = {
                    type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
                    message: 'Invalid track index'
                };
                return result;
            }
            break;

        case 'prev':
        case 'next':
        case 'cancel':
            // Format: search_action_sessionId
            if (rest.length < 1) {
                result.error = {
                    type: ERROR_TYPES.VALIDATION.MALFORMED_CUSTOM_ID,
                    message: `${action} action requires sessionId`
                };
                return result;
            }
            sessionId = rest[0];
            extra = rest.slice(1);
            break;

        default:
            result.error = {
                type: ERROR_TYPES.VALIDATION.MALFORMED_CUSTOM_ID,
                message: `Unknown action: ${action}`
            };
            return result;
    }

    // Validate sessionId format and length
    if (!sessionId || sessionId.length > SANITIZATION.MAX_SESSION_ID_LENGTH) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: 'Invalid session ID format or length'
        };
        return result;
    }

    result.isValid = true;
    result.action = action;
    result.sessionId = sessionId;
    result.extra = extra;
    return result;
}

/**
 * Validates search query input
 * @param {string} query - Search query to validate
 * @returns {Object} Validation result
 */
function validateSearchQuery(query) {
    const result = {
        isValid: false,
        sanitized: null,
        error: null
    };

    if (!query || typeof query !== 'string') {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: 'Query must be a non-empty string'
        };
        return result;
    }

    const trimmed = query.trim();
    
    if (trimmed.length === 0) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: 'Query cannot be empty'
        };
        return result;
    }

    if (trimmed.length > SEARCH_SESSION.MAX_SEARCH_QUERY_LENGTH) {
        result.error = {
            type: ERROR_TYPES.VALIDATION.INVALID_INPUT,
            message: `Query exceeds maximum length of ${SEARCH_SESSION.MAX_SEARCH_QUERY_LENGTH} characters`
        };
        return result;
    }

    result.isValid = true;
    result.sanitized = trimmed;
    return result;
}

/**
 * Creates a standardized error response
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Error message
 * @param {Object} context - Additional context information
 * @returns {Object} Standardized error object
 */
function createError(type, message, context = {}) {
    return {
        type,
        message,
        context,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    generateSecureSessionId,
    validateCustomId,
    parseSearchCustomId,
    validateSearchQuery,
    createError
};