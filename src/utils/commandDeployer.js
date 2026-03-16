const { REST, Routes } = require('discord.js');
const logger = require('./logger');

async function deployCommands(client) {
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands globally.`);

        const data = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        logger.error('Failed to deploy commands:', error);
    }
}

module.exports = deployCommands;