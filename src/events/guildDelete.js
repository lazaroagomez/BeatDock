const { Events } = require('discord.js');
const { emptyChannelTimeouts } = require('./voiceStateUpdate');

module.exports = {
    name: Events.GuildDelete,
    async execute(guild) {
        const guildId = guild.id;

        // Clear any pending empty-channel disconnect timer for this guild
        if (emptyChannelTimeouts.has(guildId)) {
            clearTimeout(emptyChannelTimeouts.get(guildId));
            emptyChannelTimeouts.delete(guildId);
        }
    },
};
