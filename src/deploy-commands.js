require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const commands = [];
const seenNames = new Set();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    const commandData = command.data.toJSON();

    if (seenNames.has(commandData.name)) {
        logger.warn(`Duplicate command name "${commandData.name}" found in ${file}, skipping.`);
        continue;
    }

    seenNames.add(commandData.name);
    commands.push(commandData);
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands globally.`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        logger.error('Failed to deploy commands:', error);
    }
})(); 