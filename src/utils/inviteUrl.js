const { PermissionsBitField } = require('discord.js');

const REQUIRED_PERMISSIONS = [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
];

function generateInviteUrl(clientId) {
    const permissions = new PermissionsBitField(REQUIRED_PERMISSIONS);
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions.bitfield}&scope=bot%20applications.commands`;
}

module.exports = { generateInviteUrl };
