const { Events } = require('discord.js');
const { generateInviteUrl } = require('../utils/inviteUrl');
const deployCommands = require('../utils/commandDeployer');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Bot ready as ${client.user.tag}`);

        await deployCommands(client);

        await client.lavalink.init({ ...client.user });
        logger.info('Lavalink initialized');

        const inviteUrl = generateInviteUrl(client.user.id);
        logger.info(`Invite URL: ${inviteUrl}`);

        client.user.setActivity(null);
    },
};
