const { ActivityType } = require('discord.js');
const { generateInviteUrl } = require('../utils/inviteUrl');
const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Bot ready as ${client.user.tag}`);

        // Initialize Lavalink
        await client.lavalink.init({ ...client.user });
        logger.info('Lavalink initialized');

        const inviteUrl = generateInviteUrl(client.user.id);
        logger.info(`Invite URL: ${inviteUrl}`);

        // No initial presence - will be set when music starts playing
        client.user.setActivity(null);
    },
}; 