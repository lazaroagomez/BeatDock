/**
 * Permission checker module
 * Validates if a user has permission to use bot commands based on:
 * - Administrator permissions (always allowed)
 * - Roles specified in ALLOWED_ROLES environment variable
 * - If no roles are specified, everyone can use the bot
 */

const { PermissionsBitField, MessageFlags } = require('discord.js');
const logger = require('./logger');

// Cache allowed roles at module level — env vars don't change at runtime
const ALLOWED_ROLES = (process.env.ALLOWED_ROLES || '')
    .split(',')
    .map(role => role.trim())
    .filter(role => role);

/**
 * Checks if a member has Administrator permissions.
 * @param {PermissionsBitField} memberPermissions - The member's permissions.
 * @returns {boolean}
 */
function isAdmin(memberPermissions) {
    return memberPermissions.has(PermissionsBitField.Flags.Administrator);
}

/**
 * Check if user has permission to use the bot.
 * @param {import('discord.js').GuildMember} member - The guild member to check.
 * @returns {boolean} Whether the user has permission.
 */
function hasPermission(member) {
    // Create a PermissionsBitField object from the raw permissions data to prevent crashes
    const memberPermissions = new PermissionsBitField(member.permissions);

    // Admins always have permission
    if (isAdmin(memberPermissions)) {
        return true;
    }

    // If no roles are specified, everyone can use the bot
    if (!ALLOWED_ROLES.length) {
        return true;
    }

    // Check if member has any of the allowed roles
    return member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
}

/**
 * Middleware to check permissions for an interaction.
 * @param {import('discord.js').Interaction} interaction - The interaction to check.
 * @returns {Promise<boolean>} Whether the interaction should continue.
 */
async function checkInteractionPermission(interaction) {
    const { client, member } = interaction;

    // Check if user has permission
    if (!hasPermission(member)) {
        const lang = client.defaultLanguage;
        try {
            await interaction.reply({
                content: client.languageManager.get(lang, 'NO_PERMISSION'),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            if (error.code === 10062) {
                logger.warn('Interaction expired while checking permissions');
            }
        }
        return false;
    }

    return true;
}

module.exports = {
    hasPermission,
    checkInteractionPermission
};
 