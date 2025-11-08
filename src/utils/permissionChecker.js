/**
 * Permission checker module
 * Validates if a user has permission to use bot commands based on:
 * - Administrator permissions (always allowed)
 * - Roles specified in ALLOWED_ROLES environment variable
 * - If no roles are specified, everyone can use the bot
 */

const { PermissionsBitField } = require('discord.js');

/**
 * Checks if a member has Administrator permissions.
 * @param {PermissionsBitField} memberPermissions - The member's permissions.
 * @returns {boolean}
 */
function isAdmin(memberPermissions) {
    return memberPermissions.has(PermissionsBitField.Flags.Administrator);
}

/**
 * Parses and returns the list of allowed role IDs from environment variables.
 * @returns {string[]}
 */
function getAllowedRoles() {
    const allowedRolesString = process.env.ALLOWED_ROLES || '';
    return allowedRolesString
        .split(',')
        .map(role => role.trim())
        .filter(role => role);
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

    const allowedRoles = getAllowedRoles();
    
    // If no roles are specified, everyone can use the bot
    if (!allowedRoles.length) {
        return true;
    }

    // Check if member has any of the allowed roles
    return member.roles.cache.some(role => allowedRoles.includes(role.id));
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
 