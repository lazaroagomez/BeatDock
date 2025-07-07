/**
 * Permission checker module
 * Validates if a user has permission to use bot commands based on:
 * - Administrator permissions (always allowed)
 * - Roles specified in ALLOWED_ROLES environment variable
 * - If no roles are specified, everyone can use the bot
 */

const { PermissionsBitField } = require('discord.js');

/**
 * Check if user has permission to use the bot
 * @param {import('discord.js').GuildMember} member - The guild member to check
 * @returns {boolean} Whether the user has permission
 */
function hasPermission(member) {
    // Admins always have permission
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }

    // Get allowed roles from environment
    const allowedRolesString = process.env.ALLOWED_ROLES || '';
    
    // If no roles are specified, everyone can use the bot
    if (!allowedRolesString.trim()) {
        return true;
    }

    // Parse allowed roles
    const allowedRoles = allowedRolesString
        .split(',')
        .map(role => role.trim())
        .filter(role => role);

    // Check if member has any of the allowed roles
    return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

/**
 * Middleware to check permissions for an interaction
 * @param {import('discord.js').Interaction} interaction - The interaction to check
 * @returns {Promise<boolean>} Whether the interaction should continue
 */
async function checkInteractionPermission(interaction) {
    const { client, member } = interaction;
    
    // Check if user has permission
    if (!hasPermission(member)) {
        const lang = client.defaultLanguage;
        await interaction.reply({ 
            content: client.languageManager.get(lang, 'NO_PERMISSION'), 
            ephemeral: true 
        });
        return false;
    }
    
    return true;
}

module.exports = {
    hasPermission,
    checkInteractionPermission
}; 