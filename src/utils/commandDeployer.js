const { REST, Routes } = require('discord.js');
const logger = require('./logger');

async function deployCommands(client) {
    const commands = [];
    const seenNames = new Set();

    client.commands.forEach(command => {
        const commandData = command.data.toJSON();

        if (seenNames.has(commandData.name)) {
            logger.warn(`Duplicate command name "${commandData.name}", skipping.`);
            return;
        }

        seenNames.add(commandData.name);
        commands.push(commandData);
    });

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        logger.info(`Refreshing ${commands.length} application (/) commands globally.`);

        const data = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        logger.info(`Successfully registered ${data.length} application (/) commands globally.`);
    } catch (error) {
        logger.error('Failed to deploy commands:', error);
    }
}

module.exports = deployCommands;
